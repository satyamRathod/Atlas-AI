import type { ToolCallInfo } from '@/langchain/tools/index.js';

/**
 * One resolved ReAct step — a `Thought`/`Action`/`Action Input` decision
 * plus (if an action was taken) its `Observation` (§4 of
 * docs/phases/phase-6-agents.md). `status: 'final'` means this step had no
 * action — it's the concluding thought that carried the final answer, so
 * `action`/`actionInput`/`observation` are all absent.
 */
export interface AgentStepInfo {
  index: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  status: 'success' | 'error' | 'final';
  observation?: unknown;
  error?: string;
  durationMs: number;
}

/** The upfront plan plus every step actually taken — what `ChatResponse.agentRun` / the `done` SSE event carries (§5). */
export interface AgentRunInfo {
  plan: readonly string[];
  steps: readonly AgentStepInfo[];
}

/** Yielded by `ReactAgentRunner.run()` the instant a plan/step is decided, so the streaming path can forward live progress (§4). */
export type AgentLoopEvent =
  | { type: 'agent_plan'; plan: readonly string[] }
  | { type: 'agent_thought'; step: AgentStepStart }
  | { type: 'agent_observation'; step: AgentStepInfo };

/** A step the instant its thought/action is decided, before the action has run (or before it's known there is no action). Mirrors Phase 5's `ToolCallStart`. */
export interface AgentStepStart {
  index: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
}

/** What `parseReactResponse()` extracts from one raw model completion (§2). Exactly one of `action` or `finalAnswer` is ever meaningfully set. */
export interface ReactParseResult {
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  finalAnswer?: string;
}

/** One registered tool's info, as rendered into the ReAct system prompt's plain-text tool list (§2) — deliberately not the native `bindTools` schema. */
export interface AgentToolDescriptor {
  name: string;
  description: string;
  /** A short, human-readable summary of the args shape, e.g. `{ expression: string }` — parsed once from each tool's Zod schema at boot. */
  argsHint: string;
}

/** Re-exported here so `react-agent-runner.ts` doesn't need to reach into `langchain/tools/` directly for this one type. */
export type { ToolCallInfo };
