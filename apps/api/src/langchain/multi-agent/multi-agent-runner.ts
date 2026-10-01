import { randomUUID } from 'node:crypto';
import type { RunnableConfig } from '@langchain/core/runnables';
import type {
  AgentRole,
  MultiAgentLoopEvent,
  MultiAgentRunInfo,
  MultiAgentTurnInfo,
  ToolCallInfo,
} from './multi-agent.types.js';
import type { CompiledMultiAgentGraph } from './multi-agent-graph.js';
import { MULTI_AGENT_LOOP_EXHAUSTED_TEXT } from './multi-agent-graph.js';
import type { MultiAgentStateType } from './multi-agent-state.js';

export interface MultiAgentRunInput {
  question: string;
  context: string;
  summary: string;
  memory: string;
}

export interface MultiAgentRunResult {
  reply: string;
  multiAgentRun: MultiAgentRunInfo;
  toolCallLog: readonly ToolCallInfo[];
}

/** The `tasks` stream mode's shape — see `graph-agent-runner.ts`'s identical comment (Phase 7). */
interface TaskStreamItem {
  id: string;
  name: string;
  input?: unknown;
  result?: unknown;
}

const AGENT_ROLES: readonly AgentRole[] = [
  'coordinator',
  'planner',
  'researcher',
  'writer',
  'reviewer',
];

function isAgentRole(name: string): name is AgentRole {
  return (AGENT_ROLES as readonly string[]).includes(name);
}

/**
 * Drives the compiled Phase 8 supervisor graph (§1 of
 * docs/phases/phase-8-multi-agent.md) for one turn. Unlike Phase 7's
 * `GraphAgentRunner`, there's no interrupt/resume split — a multi-agent
 * turn always runs start-to-finish in one call, so this is a plain
 * generator that always returns a complete `MultiAgentRunResult`.
 *
 * Node names in `multi-agent-graph.ts` are exactly the `AgentRole` values,
 * so translating a `tasks`-mode task into a turn event needs no lookup
 * table, just a cast.
 */
export class MultiAgentRunner {
  constructor(private readonly compiledGraph: CompiledMultiAgentGraph) {}

  public async *run(
    input: MultiAgentRunInput,
    sessionId: string,
    enabledToolNames: string[] | undefined,
  ): AsyncGenerator<MultiAgentLoopEvent, MultiAgentRunResult, void> {
    const initialState: Partial<MultiAgentStateType> = {
      question: input.question,
      contextText: input.context,
      summaryText: input.summary,
      memoryText: input.memory,
      enabledToolNames,
      plan: [],
      researchNotes: [],
      draftHistory: [],
      reviewHistory: [],
      communicationLog: [],
      toolCallLog: [],
      roundCount: 0,
      nextAgent: undefined,
    };

    // A *fresh* thread per turn, not a shared `magent:{sessionId}` thread
    // reused across every message in the conversation: the blackboard state
    // (`plan`/`researchNotes`/`draftHistory`/etc.) is scoped to one
    // question, and several of its channels use a concat reducer, so
    // reusing the same thread_id across turns would silently accumulate
    // one turn's plan/drafts/reviews onto the next turn's — a shared
    // `messages` transcript (Phase 7's design) is meant to grow across
    // turns, a per-turn blackboard is not. The `magent:` prefix still keeps
    // this fully separate from Phase 7's checkpoint namespace either way.
    const threadId = `magent:${sessionId}:${randomUUID()}`;
    const config: RunnableConfig = { configurable: { thread_id: threadId } };

    const turns: MultiAgentTurnInfo[] = [];
    const startedAt = new Map<string, number>();
    // Tracks how many `coordinator` visits have completed — every
    // specialist's round number "belongs to" the coordinator dispatch that
    // most recently triggered it, i.e. `roundCounter - 1` at the time the
    // specialist runs (the coordinator's own round is `roundCounter`,
    // before its end event bumps the counter).
    let roundCounter = 0;

    // `.stream()`'s public type doesn't narrow by `streamMode` — see the
    // identical comment in Phase 7's `graph-agent-runner.ts`.
    // biome-ignore lint/suspicious/noExplicitAny: see comment above.
    const stream = (await this.compiledGraph.stream(initialState as any, {
      ...config,
      streamMode: 'tasks',
    })) as AsyncIterable<TaskStreamItem>;

    for await (const item of stream) {
      if (!isAgentRole(item.name)) {
        continue;
      }
      const role = item.name;
      const round = role === 'coordinator' ? roundCounter : Math.max(0, roundCounter - 1);

      if (item.result !== undefined) {
        const startTime = startedAt.get(item.id) ?? Date.now();
        const turn: MultiAgentTurnInfo = {
          role,
          round,
          status: 'success',
          durationMs: Date.now() - startTime,
        };
        turns.push(turn);
        yield { type: 'agent_turn_end', turn };

        if (role === 'coordinator') {
          roundCounter += 1;
        }
      } else {
        startedAt.set(item.id, Date.now());
        yield { type: 'agent_turn_start', turn: { role, round, status: 'running' } };
      }
    }

    const snapshot = await this.compiledGraph.getState(config);
    const state = snapshot.values as MultiAgentStateType;

    const latestDraft = state.draftHistory.at(-1)?.content.trim();
    const reply =
      latestDraft && latestDraft.length > 0 ? latestDraft : MULTI_AGENT_LOOP_EXHAUSTED_TEXT;

    return {
      reply,
      toolCallLog: state.toolCallLog,
      multiAgentRun: {
        turns,
        plan: state.plan,
        researchNotes: state.researchNotes,
        draftHistory: state.draftHistory,
        reviewHistory: state.reviewHistory,
        communicationLog: state.communicationLog,
        threadId,
      },
    };
  }
}
