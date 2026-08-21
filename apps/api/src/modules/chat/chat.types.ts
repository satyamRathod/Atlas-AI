import type { UsageMetadata } from '@langchain/core/messages';

import type { AgentRunInfo, AgentStepInfo, AgentStepStart } from '@/langchain/agents/index.js';
import type { GuardrailReport } from '@/langchain/guardrails/index.js';
import type { MemoryInfo } from '@/langchain/memory/index.js';
import type { StructuredAnswer } from '@/langchain/parsers/index.js';
import type { AdvancedRetrieveOptions, RetrievalStageTiming } from '@/langchain/retrieval/index.js';
import type { ToolCallInfo, ToolCallStart } from '@/langchain/tools/index.js';

export interface StreamOptions {
  signal?: AbortSignal;
}

export type RetrievalOptions = Pick<
  AdvancedRetrieveOptions,
  'strategy' | 'filter' | 'useMmr' | 'useRerank' | 'useCompression' | 'useQueryExpansion'
>;

export interface ChatCitation {
  index: number;
  source: string;
  title?: string;
  score: number;
  snippet: string;
  /** Full chunk content, untruncated — powers the source preview UI. */
  content: string;
  category?: string;
  docType?: string;
}

/**
 * Which retrieval strategy actually ran, plus a per-stage timeline. Present
 * on every response so a future strategy switcher / retrieval timeline UI
 * (Phase 2 UI) has something to render even when the client didn't
 * explicitly request a strategy.
 */
export interface RetrievalInfo {
  strategy: string;
  stages: readonly RetrievalStageTiming[];
}

/** The resolved variables that actually went into the prompt for this turn — the authoritative source for a Variable Inspector UI, instead of the client guessing (§6). */
export interface PromptVariablesSnapshot {
  context: string;
  summary: string;
  memory: string;
  question: string;
}

/** Which template/version rendered this turn's prompt, and whether few-shot examples were spliced in (§3, §6). */
export interface PromptInfo {
  templateId: string;
  templateName: string;
  version: number;
  usedFewShot: boolean;
  variables: PromptVariablesSnapshot;
}

/** Present only when the request asked for `structuredOutput: true` (§4). `valid: false` means schema validation failed and `data` is omitted. */
export interface StructuredOutputInfo {
  schemaName: string;
  data?: StructuredAnswer;
  valid: boolean;
  errors?: string[];
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  retrieval: RetrievalInfo;
  memory: MemoryInfo;
  promptInfo: PromptInfo;
  guardrails: GuardrailReport;
  structuredOutput?: StructuredOutputInfo;
  /** Present only when the request asked for `useTools: true` (§4 of docs/phases/phase-5-tools.md). */
  toolCalls?: readonly ToolCallInfo[];
  /** Present only when the request asked for `useAgent: true` (§3 of docs/phases/phase-6-agents.md) — the upfront plan plus every ReAct step actually taken. */
  agentRun?: AgentRunInfo;
  usage?: UsageMetadata;
}

export type StreamChunkType =
  | 'citations'
  | 'token'
  | 'tool_call'
  | 'tool_result'
  | 'agent_plan'
  | 'agent_thought'
  | 'agent_observation'
  | 'done'
  | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
  /**
   * Only ever attached to the `done` event — token/budget/summary numbers
   * aren't final until the turn actually completes (Phase 3 §8).
   */
  memory?: MemoryInfo;
  /** Also only on `done` — resolved after the model call, same reasoning as `memory` above. */
  promptInfo?: PromptInfo;
  guardrails?: GuardrailReport;
  structuredOutput?: StructuredOutputInfo;
  /**
   * `tool_call` (before execution) and `tool_result` (right after) are a
   * deliberate exception to the "only attach new fields on `done`"
   * convention above — it's the only way the UI gets a genuine live
   * timeline. `done` still also carries the full aggregated `toolCalls`
   * array as a reconciliation source of truth (§4).
   */
  toolCall?: ToolCallStart;
  toolResult?: ToolCallInfo;
  toolCalls?: readonly ToolCallInfo[];
  /**
   * `agent_plan` (once, right after planning), `agent_thought` (per step,
   * before execution/on final answer), and `agent_observation` (per step,
   * right after execution) are Phase 6's analogue of `toolCall`/
   * `toolResult` above — the same deliberate live-progress exception.
   * `done` also carries the full `agentRun` for reconciliation (§3 of
   * docs/phases/phase-6-agents.md).
   */
  agentPlan?: readonly string[];
  agentStep?: AgentStepStart;
  agentObservation?: AgentStepInfo;
  agentRun?: AgentRunInfo;
  model?: string;
  usage?: UsageMetadata;
  message?: string;
}
