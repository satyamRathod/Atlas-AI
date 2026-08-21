import type { AIMessage, BaseMessage, UsageMetadata } from '@langchain/core/messages';
import { AIMessage as AIMessageClass, HumanMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import { Command } from '@langchain/langgraph';

import type { CompiledAgentGraph } from './agent-graph.js';
import type {
  GraphLoopEvent,
  GraphNodeInfo,
  GraphResumeDecision,
  PendingApprovalInfo,
} from './graph.types.js';
import type { GraphStateType } from './graph-state.js';

export interface GraphRunInput {
  question: string;
  context: string;
  summary: string;
  memory: string;
}

export interface GraphRunResult {
  interrupted: boolean;
  reply?: string;
  usage?: UsageMetadata;
  nodes: GraphNodeInfo[];
  toolCallLog?: GraphStateType['toolCallLog'];
  turnMeta?: Record<string, unknown>;
  pendingApproval?: PendingApprovalInfo;
}

/** The `tasks` stream mode's shape: a task-create item (has `input`, no `result`) or a task-result item (has `result`) — see docs.langchain.com/oss/javascript/langgraph/streaming/event-streaming. */
interface TaskStreamItem {
  id: string;
  name: string;
  input?: unknown;
  result?: unknown;
}

/**
 * Reconstructs the pending approval payload from the last `AIMessage`'s
 * `tool_calls` instead of reading it back off `snapshot.tasks[].interrupts`
 * (the value passed to `interrupt()` in `humanApprovalNode`).
 *
 * `@langchain/langgraph-checkpoint-redis@1.0.11`'s `putWrites()` only flips
 * a checkpoint's `has_writes` flag when that checkpoint document already
 * exists at write time; for the very checkpoint an interrupt pauses on,
 * that ordering doesn't hold, so `getState()` silently comes back with
 * `tasks[].interrupts: []` even though the write is sitting in Redis. The
 * `tool_calls` we need are already sitting in checkpointed state (no
 * dependence on that write path), so we rebuild the identical payload from
 * there instead.
 */
function readPendingApproval(messages: BaseMessage[]): PendingApprovalInfo | undefined {
  const last = [...messages]
    .reverse()
    .find((message): message is AIMessage => AIMessageClass.isInstance(message));
  const toolCalls = last?.tool_calls ?? [];
  if (toolCalls.length === 0) {
    return undefined;
  }

  return {
    toolCalls: toolCalls.map((call) => ({
      id: call.id ?? '',
      name: call.name,
      args: call.args,
    })),
    reason: `Approval required before executing: ${toolCalls.map((call) => call.name).join(', ')}.`,
  };
}

/**
 * Drives the compiled Phase 7 agent graph (§3 of
 * docs/phases/phase-7-langgraph.md) for one turn — either a fresh `run()`
 * or a `resume()` of a previously interrupted one, both against the same
 * `thread_id` (the chat `sessionId`) so the Redis checkpointer can find the
 * paused state.
 *
 * Translates LangGraph's `tasks` stream mode into the same shape of live
 * `GraphLoopEvent`s Phase 5/6's runners already yield (`ToolLoopEvent`/
 * `AgentLoopEvent`), so `ChatService` can forward node-start/node-end
 * progress identically to `tool_call`/`tool_result` and
 * `agent_thought`/`agent_observation`.
 */
export class GraphAgentRunner {
  constructor(private readonly compiledGraph: CompiledAgentGraph) {}

  public async *run(
    input: GraphRunInput,
    sessionId: string,
    enabledToolNames: string[] | undefined,
    turnMeta: Record<string, unknown>,
  ): AsyncGenerator<GraphLoopEvent, GraphRunResult, void> {
    const initialState: Partial<GraphStateType> = {
      messages: [new HumanMessage(input.question)],
      question: input.question,
      contextText: input.context,
      summaryText: input.summary,
      memoryText: input.memory,
      enabledToolNames,
      stepCount: 0,
      toolCallLog: [],
      turnMeta,
    };

    return yield* this.driveGraph(initialState, { configurable: { thread_id: sessionId } });
  }

  public async *resume(
    sessionId: string,
    decision: GraphResumeDecision,
  ): AsyncGenerator<GraphLoopEvent, GraphRunResult, void> {
    return yield* this.driveGraph(new Command({ resume: decision }), {
      configurable: { thread_id: sessionId },
    });
  }

  private async *driveGraph(
    input: Partial<GraphStateType> | Command,
    config: RunnableConfig,
  ): AsyncGenerator<GraphLoopEvent, GraphRunResult, void> {
    const nodes: GraphNodeInfo[] = [];
    const startedAt = new Map<string, number>();

    // `.stream()`'s public type doesn't narrow by `streamMode` — the
    // `tasks` mode's actual runtime shape (TaskStreamItem) is documented
    // but not exported as a type.
    // biome-ignore lint/suspicious/noExplicitAny: see comment above.
    const stream = (await this.compiledGraph.stream(input as any, {
      ...config,
      streamMode: 'tasks',
    })) as AsyncIterable<TaskStreamItem>;

    for await (const item of stream) {
      if (item.result !== undefined) {
        const startTime = startedAt.get(item.id) ?? Date.now();
        const info: GraphNodeInfo = {
          nodeId: item.name,
          status: 'success',
          durationMs: Date.now() - startTime,
        };
        nodes.push(info);
        yield { type: 'graph_node_end', node: info };
      } else {
        startedAt.set(item.id, Date.now());
        yield { type: 'graph_node_start', node: { nodeId: item.name, status: 'running' } };
      }
    }

    const snapshot = await this.compiledGraph.getState(config);

    if (snapshot.next.length > 0) {
      const interruptedNode = snapshot.next[0];

      if (interruptedNode) {
        const info: GraphNodeInfo = { nodeId: interruptedNode, status: 'interrupted' };
        nodes.push(info);
        yield { type: 'graph_node_end', node: info };
      }

      const interruptedTurnMeta = snapshot.values.turnMeta as Record<string, unknown> | undefined;
      const pendingApproval = readPendingApproval(snapshot.values.messages as BaseMessage[]);

      return {
        interrupted: true,
        nodes,
        ...(pendingApproval ? { pendingApproval } : {}),
        ...(interruptedTurnMeta ? { turnMeta: interruptedTurnMeta } : {}),
      };
    }

    const finalMessages = snapshot.values.messages as BaseMessage[];
    // Chat models return `AIMessageChunk` (a `BaseMessageChunk` subclass,
    // not `AIMessage`), so `instanceof AIMessageClass` would miss it —
    // `AIMessage.isInstance()` duck-types on `type === 'ai'` and matches both.
    const reply = [...finalMessages]
      .reverse()
      .find((message): message is AIMessage => AIMessageClass.isInstance(message));
    const finalTurnMeta = snapshot.values.turnMeta as Record<string, unknown> | undefined;

    return {
      interrupted: false,
      reply: reply?.text ?? '',
      nodes,
      toolCallLog: snapshot.values.toolCallLog,
      ...(reply?.usage_metadata ? { usage: reply.usage_metadata } : {}),
      ...(finalTurnMeta ? { turnMeta: finalTurnMeta } : {}),
    };
  }
}
