import { Annotation } from '@langchain/langgraph';

import type { ToolCallInfo } from '@/langchain/tools/index.js';

import type {
  AgentMessage,
  AgentRole,
  DraftVersion,
  ResearchNote,
  ReviewVerdict,
} from './multi-agent.types.js';

/**
 * The Phase 8 supervisor graph's shared "blackboard" state (§1 of
 * docs/phases/phase-8-multi-agent.md). Deliberately *not* a growing
 * `messages` transcript like Phase 7's `GraphState` — each specialist
 * reads/writes a small set of explicit fields instead of one shared
 * conversation, which is both a closer fit for "shared state" (every
 * field has one clear owner/purpose) and lets the coordinator render a
 * compact summary of *everything* on every routing decision instead of
 * re-reading a whole message history.
 */
export const MultiAgentState = Annotation.Root({
  question: Annotation<string>,
  contextText: Annotation<string>,
  summaryText: Annotation<string>,
  memoryText: Annotation<string>,
  enabledToolNames: Annotation<string[] | undefined>,

  /** Planner's latest ordered steps — replaced (not appended) each time the planner runs, since a later plan supersedes an earlier one. */
  plan: Annotation<string[]>({
    reducer: (_left, right) => right,
    default: () => [],
  }),
  /** Every researcher visit's findings, oldest first. */
  researchNotes: Annotation<ResearchNote[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  /** Every writer visit's draft, oldest first — the Output Comparison UI's data source. */
  draftHistory: Annotation<DraftVersion[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  /** Every reviewer visit's verdict, oldest first. */
  reviewHistory: Annotation<ReviewVerdict[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  /** The coordinator's full dispatch log, oldest first — the Communication Timeline UI's data source. */
  communicationLog: Annotation<AgentMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  /** Every tool call any researcher visit made, oldest first — mirrors Phase 7's `toolCallLog`. */
  toolCallLog: Annotation<ToolCallInfo[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  /** Bumped once per coordinator visit — the round cap (`MULTI_AGENT_MAX_ROUNDS`) is checked against this. */
  roundCount: Annotation<number>({
    reducer: (_left, right) => right,
    default: () => 0,
  }),
  /**
   * The coordinator's routing decision for *this* visit — written by
   * `coordinatorNode`, read by `routeAfterCoordinator` right after (a
   * conditional-edge function can't return extra state itself, so the
   * decision has to be stashed here first, the same reason Phase 7's
   * `routeAfterAgent` reads `state.messages` instead of a return value).
   */
  nextAgent: Annotation<AgentRole | 'finish' | undefined>,
});

export type MultiAgentStateType = typeof MultiAgentState.State;
