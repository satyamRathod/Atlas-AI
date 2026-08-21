import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { Command, END, interrupt, START, StateGraph } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

import type { ToolExecutor } from '@/langchain/tools/index.js';
import type { GraphResumeDecision, PendingApprovalInfo } from './graph.types.js';
import { buildGraphSystemPrompt } from './graph-prompt.js';
import { GraphState, type GraphStateType } from './graph-state.js';

const GRAPH_LOOP_EXHAUSTED_TEXT =
  "I wasn't able to reach a final answer using the available tools within the allowed number of steps. Here's what I found so far, though it may be incomplete.";

export interface AgentGraphOptions {
  chatModel: BaseChatModel;
  toolExecutor: ToolExecutor;
  checkpointer: BaseCheckpointSaver;
  /** Tool names that must route through `human_approval` before executing (§2/§4). */
  approvalToolNames: readonly string[];
  maxSteps: number;
}

/**
 * Chat models stream/return `AIMessageChunk` (a `BaseMessageChunk`
 * subclass), not plain `AIMessage` — `instanceof AIMessage` is `false` for
 * those, so we duck-type on `type === 'ai'` via `AIMessage.isInstance()`
 * (the non-deprecated replacement for the old `isAIMessage()` helper),
 * which matches both.
 */
function lastAIMessage(messages: GraphStateType['messages']): AIMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (AIMessage.isInstance(message)) {
      return message;
    }
  }
  return undefined;
}

/**
 * Builds and compiles the Phase 7 agent graph (§3 of
 * docs/phases/phase-7-langgraph.md):
 *
 * ```
 * START -> agent -[no tool_calls]-> END
 *          agent -[sensitive tool_call]-> human_approval
 *          agent -[other tool_call]-> tools
 *          human_approval -[approved]-> tools
 *          human_approval -[rejected]-> agent
 *          tools -> agent
 * ```
 *
 * `agent` uses native `bindTools()` (same mechanism as Phase 5, not Phase
 * 6's hand-rolled ReAct text parsing) — LangGraph's job here is the
 * *orchestration* (state, conditional routing, checkpoints, interrupts),
 * not the model's decision mechanism.
 */
export function buildAgentGraph(options: AgentGraphOptions) {
  const { chatModel, toolExecutor, checkpointer, approvalToolNames, maxSteps } = options;

  if (typeof chatModel.bindTools !== 'function') {
    throw new Error('The configured chat model does not support tool calling.');
  }
  const { bindTools } = chatModel;

  async function agentNode(state: GraphStateType) {
    if (state.stepCount >= maxSteps) {
      return {
        messages: [new AIMessage(GRAPH_LOOP_EXHAUSTED_TEXT)],
        stepCount: state.stepCount + 1,
      };
    }

    const bindableTools = toolExecutor.getBindableTools(state.enabledToolNames);
    const modelWithTools = bindTools.call(chatModel, bindableTools);
    const systemMessage = new SystemMessage(
      buildGraphSystemPrompt({
        context: state.contextText,
        summary: state.summaryText,
        memory: state.memoryText,
      }),
    );

    const response = await modelWithTools.invoke([systemMessage, ...state.messages]);

    return { messages: [response], stepCount: state.stepCount + 1 };
  }

  function routeAfterAgent(state: GraphStateType): 'tools' | 'human_approval' | typeof END {
    const last = lastAIMessage(state.messages);
    const toolCalls = last?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      return END;
    }

    const needsApproval = toolCalls.some((call) => approvalToolNames.includes(call.name));
    return needsApproval ? 'human_approval' : 'tools';
  }

  /**
   * Calls `interrupt()` with the proposed tool call(s) and pauses — the
   * checkpointer persists the entire graph state right here, so a resume
   * can arrive any time later, from any process (§4). On resume,
   * `interrupt()` returns the `GraphResumeDecision` the client sent, and
   * this node re-runs from the top (LangGraph's documented interrupt
   * semantics), immediately getting that cached value instead of pausing
   * again.
   */
  async function humanApprovalNode(state: GraphStateType) {
    const last = lastAIMessage(state.messages);
    const toolCalls = last?.tool_calls ?? [];

    const pending: PendingApprovalInfo = {
      toolCalls: toolCalls.map((call) => ({
        id: call.id ?? randomUUID(),
        name: call.name,
        args: call.args,
      })),
      reason: `Approval required before executing: ${toolCalls.map((call) => call.name).join(', ')}.`,
    };

    const decision = interrupt<PendingApprovalInfo, GraphResumeDecision>(pending);

    if (!decision?.approved) {
      const rejectionMessages = toolCalls.map(
        (call) =>
          new ToolMessage({
            content: `This action was rejected by the user${decision?.feedback ? `: ${decision.feedback}` : '.'}`,
            tool_call_id: call.id ?? randomUUID(),
            name: call.name,
          }),
      );

      return new Command({ update: { messages: rejectionMessages }, goto: 'agent' });
    }

    return new Command({ goto: 'tools' });
  }

  async function toolsNode(state: GraphStateType) {
    const last = lastAIMessage(state.messages);
    const toolCalls = last?.tool_calls ?? [];

    const results = await Promise.all(
      toolCalls.map((call) =>
        toolExecutor.execute({ id: call.id ?? randomUUID(), name: call.name, args: call.args }),
      ),
    );

    const toolMessages = results.map(
      (result) =>
        new ToolMessage({
          content:
            result.status === 'success' ? JSON.stringify(result.output) : `Error: ${result.error}`,
          tool_call_id: result.id,
          name: result.name,
        }),
    );

    return { messages: toolMessages, toolCallLog: results };
  }

  const graph = new StateGraph(GraphState)
    .addNode('agent', agentNode)
    .addNode('human_approval', humanApprovalNode, { ends: ['agent', 'tools'] })
    .addNode('tools', toolsNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeAfterAgent, {
      tools: 'tools',
      human_approval: 'human_approval',
      [END]: END,
    })
    .addEdge('tools', 'agent');

  return graph.compile({ checkpointer });
}

export type CompiledAgentGraph = ReturnType<typeof buildAgentGraph>;
