import type { ToolCallInfo } from '@/langchain/tools/index.js';

/** The five roles in the Phase 8 supervisor graph (§0/§1 of docs/phases/phase-8-multi-agent.md). Doubles as the compiled graph's node names. */
export type AgentRole = 'coordinator' | 'planner' | 'researcher' | 'writer' | 'reviewer';

/**
 * One researcher visit's findings — either from tool calls, plain
 * reasoning, or both. `toolCalls` is empty when the researcher answered
 * from context alone without needing a tool this round.
 */
export interface ResearchNote {
  round: number;
  content: string;
  toolCalls: readonly ToolCallInfo[];
}

/** One writer visit's draft — every entry is kept (never overwritten) so `draftHistory` can power the Output Comparison UI. */
export interface DraftVersion {
  round: number;
  content: string;
}

/** One reviewer visit's verdict on the *latest* draft at the time it ran. */
export interface ReviewVerdict {
  round: number;
  approved: boolean;
  feedback?: string;
}

/**
 * One entry in the coordinator's dispatch log — the "conversation between
 * agents" a communication-timeline UI renders. `from`/`to` are always
 * `coordinator` on one side, since every specialist reports back to it
 * and it dispatches to exactly one specialist at a time (§1's hub-and-spoke
 * topology — there's no direct specialist-to-specialist channel).
 */
export interface AgentMessage {
  round: number;
  from: AgentRole;
  to: AgentRole | 'finish';
  content: string;
}

/** The coordinator's routing decision — the value `withStructuredOutput` resolves to (or the deterministic fast-path's equivalent). */
export interface CoordinatorDecision {
  next: 'planner' | 'researcher' | 'writer' | 'reviewer' | 'finish';
  instructions: string;
}

/**
 * One role's execution for a single pass through the graph this turn —
 * the multi-agent analogue of Phase 7's `GraphNodeInfo`. Two of these are
 * yielded per visit (start/end) so a live dashboard/timeline can highlight
 * whichever role is currently running.
 */
export interface MultiAgentTurnInfo {
  role: AgentRole;
  round: number;
  status: 'running' | 'success' | 'error';
  durationMs?: number;
  /** A short, best-effort human-readable summary of what happened this visit (e.g. the coordinator's routing instructions) — never required for correctness. */
  summary?: string;
}

/** Yielded by `MultiAgentRunner.run()` the instant a role's visit starts or finishes — mirrors Phase 7's `GraphLoopEvent`. */
export type MultiAgentLoopEvent =
  | { type: 'agent_turn_start'; turn: MultiAgentTurnInfo }
  | { type: 'agent_turn_end'; turn: MultiAgentTurnInfo };

/** The full run for one turn — what `ChatResponse.multiAgentRun` / the `done` SSE event carries once the coordinator decides to finish. */
export interface MultiAgentRunInfo {
  turns: readonly MultiAgentTurnInfo[];
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  reviewHistory: readonly ReviewVerdict[];
  communicationLog: readonly AgentMessage[];
  /** The checkpointer thread id this run is stored under (`magent:{sessionId}`) — so a state-inspector call always knows what to ask for. */
  threadId: string;
}

export type { ToolCallInfo };
