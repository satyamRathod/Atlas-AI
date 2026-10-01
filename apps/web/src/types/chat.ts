/**
 * Mirrors apps/api/src/modules/chat/chat.types.ts. Hand-kept in sync since
 * there's no shared-types package wired up between the two apps yet.
 */

export interface ChatUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ChatCitation {
  index: number;
  source: string;
  title?: string;
  score: number;
  snippet: string;
  /** Full chunk content, untruncated — powers the source preview dialog. */
  content: string;
  category?: string;
  docType?: string;
}

/** Mirrors `RETRIEVAL_STRATEGIES` in apps/api/src/langchain/retrieval/retrieval-strategy.ts. */
export type RetrievalStrategy =
  | 'dense'
  | 'hybrid'
  | 'multi_query'
  | 'self_query'
  | 'parent_document';

export const RETRIEVAL_STRATEGIES: readonly RetrievalStrategy[] = [
  'dense',
  'hybrid',
  'multi_query',
  'self_query',
  'parent_document',
];

/** One stage of the retrieval pipeline, timed for the retrieval timeline. */
export interface RetrievalStageTiming {
  name: string;
  durationMs: number;
}

export interface RetrievalInfo {
  strategy: string;
  stages: readonly RetrievalStageTiming[];
}

export type MetadataFilterValue = string | number | boolean;

export interface MetadataFilter {
  [key: string]: MetadataFilterValue;
}

/** What the token-budget math decided for this turn, plus what trimming actually used. Mirrors `TokenBudgetInfo` in apps/api/src/langchain/memory/memory.types.ts. */
export interface TokenBudgetInfo {
  maxContextTokens: number;
  reservedOutputTokens: number;
  promptOverheadTokens: number;
  historyBudgetTokens: number;
  historyTokensUsed: number;
}

/** A semantic-memory fact surfaced for the current turn's question. */
export interface SemanticFact {
  text: string;
  score: number;
}

/** Mirrors `MemoryInfo` in apps/api/src/langchain/memory/memory.types.ts — powers the memory inspector UI. */
export interface MemoryInfo {
  historyMessageCount: number;
  historyTokens: number;
  /** `true` only on the turn where rolling summarization actually fired. */
  summarized: boolean;
  /** Present whenever a summary exists (not just on turns that just updated it). */
  summary?: string;
  tokenBudget: TokenBudgetInfo;
  semanticFacts: readonly SemanticFact[];
}

/** One fixed `{input, output}` example pair — Phase 4 few-shot prompting. Mirrors `FewShotExample` in apps/api/src/langchain/prompts/prompt-template.types.ts. */
export interface PromptFewShotExample {
  input: string;
  output: string;
}

/** One immutable, saved revision of a prompt template. Mirrors `PromptTemplateVersion` in apps/api/src/modules/prompts/prompt.types.ts. */
export interface PromptTemplateVersion {
  version: number;
  systemPrompt: string;
  fewShotExamples: readonly PromptFewShotExample[];
  createdAt: string;
}

export interface PromptTemplateSummary {
  id: string;
  name: string;
  description: string;
  latestVersion: number;
  versionCount: number;
  createdAt: string;
}

export interface PromptTemplateDetail extends PromptTemplateSummary {
  versions: readonly PromptTemplateVersion[];
}

/** The resolved variables that actually went into the prompt this turn — powers the Variable Inspector panel. */
export interface PromptVariablesSnapshot {
  context: string;
  summary: string;
  memory: string;
  question: string;
}

/** Mirrors `PromptInfo` in apps/api/src/modules/chat/chat.types.ts. */
export interface PromptInfo {
  templateId: string;
  templateName: string;
  version: number;
  usedFewShot: boolean;
  variables: PromptVariablesSnapshot;
}

/** One guardrail check's outcome. Mirrors `GuardrailResult` in apps/api/src/langchain/guardrails/guardrail.types.ts. */
export interface GuardrailResult {
  name: string;
  passed: boolean;
  message?: string;
}

/** Mirrors `GuardrailReport`. `blocked: true` means `reply` is a synthesized refusal, not a real model response. */
export interface GuardrailReport {
  input: readonly GuardrailResult[];
  output: readonly GuardrailResult[];
  blocked: boolean;
}

/** Mirrors `StructuredAnswer` in apps/api/src/langchain/parsers/structured-answer-schema.ts. */
export interface StructuredAnswer {
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  sources: readonly number[];
  followUpQuestions: readonly string[];
}

/** Present only when the request asked for `structuredOutput: true`. */
export interface StructuredOutputInfo {
  schemaName: string;
  data?: StructuredAnswer;
  valid: boolean;
  errors?: readonly string[];
}

/** One registered tool the model can call. Mirrors the `{name, description}` shape `GET /api/v1/tools` returns. */
export interface ToolDefinition {
  name: string;
  description: string;
}

/** One tool-call's outcome for a turn. Mirrors `ToolCallInfo` in apps/api/src/langchain/tools/tool.types.ts. */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'success' | 'error';
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** The instant a tool call starts, before it has a result. Mirrors `ToolCallStart`. */
export interface ToolCallStart {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * A tool call as rendered in the live timeline — a UI-only superset of
 * `ToolCallInfo` that also covers the in-flight `'running'` state between
 * the `tool_call` and `tool_result` SSE events, before `durationMs`/
 * `status` are known.
 */
export interface ToolCallDisplay {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  output?: unknown;
  error?: string;
  durationMs?: number;
}

/** One resolved ReAct step. Mirrors `AgentStepInfo` in apps/api/src/langchain/agents/agent.types.ts. */
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

/** The upfront plan plus every step actually taken. Mirrors `AgentRunInfo`. */
export interface AgentRunInfo {
  plan: readonly string[];
  steps: readonly AgentStepInfo[];
}

/** A step the instant its thought/action is decided, before it has run (or before it's known there's no action). Mirrors `AgentStepStart`. */
export interface AgentStepStart {
  index: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
}

/**
 * A ReAct step as rendered in the live reasoning timeline — a UI-only
 * superset of `AgentStepInfo` that also covers the in-flight `'acting'`
 * state between the `agent_thought` and `agent_observation` SSE events,
 * before `status`/`observation`/`durationMs` are known. A step with no
 * `action` is inferred to be the terminal one (`status: 'final'`)
 * straight from its `agent_thought` event — there's no separate
 * observation to wait for.
 */
export interface AgentStepDisplay {
  index: number;
  thought: string;
  action?: string;
  actionInput?: Record<string, unknown>;
  status: 'acting' | 'success' | 'error' | 'final';
  observation?: unknown;
  error?: string;
  durationMs?: number;
}

/** One tool call proposed by the model, awaiting a human decision. Mirrors `PendingApprovalInfo` in apps/api/src/langchain/graph/graph.types.ts. */
export interface PendingApprovalToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface PendingApprovalInfo {
  toolCalls: readonly PendingApprovalToolCall[];
  reason: string;
}

/** One node's lifecycle for a single pass through the graph this turn. Mirrors `GraphNodeInfo`. */
export interface GraphNodeInfo {
  nodeId: string;
  status: 'running' | 'success' | 'error' | 'interrupted';
  durationMs?: number;
}

/** The node-by-node timeline for a graph-mode turn. Mirrors `GraphRunInfo`. `interrupted: true` means the turn is paused awaiting `pendingApproval`. */
export interface GraphRunInfo {
  nodes: readonly GraphNodeInfo[];
  interrupted: boolean;
  threadId: string;
  pendingApproval?: PendingApprovalInfo;
}

/**
 * A graph node as rendered in the live visualization/timeline — a UI-only
 * superset of `GraphNodeInfo` that also covers the in-flight `'running'`
 * state between the `graph_node_start` and `graph_node_end` SSE events,
 * and gives every pass through the same node a stable React key.
 */
export interface GraphNodeDisplay extends GraphNodeInfo {
  /** Position in the overall node sequence for this turn (0-based) — since the same `nodeId` can appear more than once (e.g. `agent` runs before and after `tools`). */
  step: number;
}

/** The five roles in the Phase 8 supervisor graph. Mirrors `AgentRole` in apps/api/src/langchain/multi-agent/multi-agent.types.ts — doubles as the compiled graph's node names. */
export type AgentRole = 'coordinator' | 'planner' | 'researcher' | 'writer' | 'reviewer';

/** One researcher visit's findings. Mirrors `ResearchNote`. */
export interface ResearchNote {
  round: number;
  content: string;
  toolCalls: readonly ToolCallInfo[];
}

/** One writer visit's draft — every entry is kept, powering the Output Comparison view. Mirrors `DraftVersion`. */
export interface DraftVersion {
  round: number;
  content: string;
}

/** One reviewer visit's verdict on the draft at the time it ran. Mirrors `ReviewVerdict`. */
export interface ReviewVerdict {
  round: number;
  approved: boolean;
  feedback?: string;
}

/** One entry in the coordinator's dispatch log — powers the Agent Communication Timeline. Mirrors `AgentMessage`. */
export interface AgentMessage {
  round: number;
  from: AgentRole;
  to: AgentRole | 'finish';
  content: string;
}

/** One role's visit for a single pass through the graph this turn. Mirrors `MultiAgentTurnInfo`. */
export interface MultiAgentTurnInfo {
  role: AgentRole;
  round: number;
  status: 'running' | 'success' | 'error';
  durationMs?: number;
}

/**
 * A specialist/coordinator visit as rendered in the live dashboard/
 * timeline — a UI-only superset of `MultiAgentTurnInfo` that gives every
 * pass through the same role a stable React key (the same role, e.g.
 * `coordinator`, legitimately visits more than once per turn).
 */
export interface MultiAgentTurnDisplay extends MultiAgentTurnInfo {
  /** Position in the overall turn sequence for this run (0-based). */
  step: number;
}

/** The full supervisor-graph run for one turn. Mirrors `MultiAgentRunInfo`. */
export interface MultiAgentRunInfo {
  turns: readonly MultiAgentTurnInfo[];
  plan: readonly string[];
  researchNotes: readonly ResearchNote[];
  draftHistory: readonly DraftVersion[];
  reviewHistory: readonly ReviewVerdict[];
  communicationLog: readonly AgentMessage[];
  /** This turn's own checkpointer thread id (`magent:{sessionId}:{uuid}`) — a fresh thread per turn, unlike Phase 7's `graphRun.threadId` which reuses the chat session id. */
  threadId: string;
}

/** Named metrics Phase 9 exposes. Mirrors `EvaluationMetricName` in apps/api. */
export type EvaluationMetricName =
  | 'faithfulness'
  | 'precision'
  | 'recall'
  | 'hallucination'
  | 'correctness';

export type ClaimSupport = 'supported' | 'unsupported' | 'contradictory';

export interface ClaimVerdict {
  claim: string;
  support: ClaimSupport;
  rationale?: string;
}

export interface FaithfulnessResult {
  score: number;
  claims: readonly ClaimVerdict[];
  supportedCount: number;
  unsupportedCount: number;
  contradictoryCount: number;
}

export interface HallucinationResult {
  detected: boolean;
  rate: number;
  claims: readonly ClaimVerdict[];
}

export interface PrecisionResult {
  score: number;
  citationScores: readonly { index: number; relevant: boolean; method: 'heuristic' | 'llm' }[];
}

export interface RecallResult {
  score: number;
  groundTruthClaims: readonly { claim: string; covered: boolean }[];
}

export interface MetricScore {
  name: EvaluationMetricName;
  score: number;
}

/** Full evaluation payload for one turn or benchmark case. Mirrors `EvaluationRunInfo`. */
export interface EvaluationRunInfo {
  mode: 'turn' | 'benchmark';
  scores: readonly MetricScore[];
  faithfulness: FaithfulnessResult;
  hallucination: HallucinationResult;
  precision: PrecisionResult;
  recall?: RecallResult;
  correctness?: { score: number };
  durationMs: number;
}

export interface BenchmarkCase {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedContextHints?: readonly string[];
}

export interface BenchmarkCaseResult {
  caseId: string;
  question: string;
  reply: string;
  citationCount: number;
  evaluation: EvaluationRunInfo;
}

export interface BenchmarkRunSummary {
  runId: string;
  createdAt: string;
  caseCount: number;
  aggregateScores: readonly MetricScore[];
  cases: readonly BenchmarkCaseResult[];
  durationMs: number;
}

/** Thin list row from `GET /api/v1/evaluation/runs`. */
export interface BenchmarkRunListItem {
  runId: string;
  createdAt: string;
  caseCount: number;
  aggregateScores: readonly MetricScore[];
  durationMs: number;
}

export interface EvaluationSettings {
  useEvaluation: boolean;
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
  /** Present only when the request asked for `useTools: true` (Phase 5). */
  toolCalls?: readonly ToolCallInfo[];
  /** Present only when the request asked for `useAgent: true` (Phase 6). */
  agentRun?: AgentRunInfo;
  /** Present only when the request asked for `useGraph: true` (Phase 7). When `graphRun.interrupted` is `true`, `reply` is a placeholder and `graphRun.pendingApproval` describes what's being asked. */
  graphRun?: GraphRunInfo;
  /** Present only when the request asked for `useMultiAgent: true` (Phase 8). Unlike `graphRun`, a multi-agent turn never pauses — it always runs to completion in the same call. */
  multiAgentRun?: MultiAgentRunInfo;
  /** Present only when the request asked for `useEvaluation: true` (Phase 9). */
  evaluation?: EvaluationRunInfo;
  usage?: ChatUsage;
}

export type StreamChunkType =
  | 'citations'
  | 'token'
  | 'tool_call'
  | 'tool_result'
  | 'agent_plan'
  | 'agent_thought'
  | 'agent_observation'
  | 'graph_node_start'
  | 'graph_node_end'
  | 'graph_interrupt'
  | 'agent_turn_start'
  | 'agent_turn_end'
  | 'done'
  | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
  /** Only ever attached to the `done` event — memory numbers aren't final until the turn completes. */
  memory?: MemoryInfo;
  /** Also only on `done` — same reasoning as `memory` above. */
  promptInfo?: PromptInfo;
  guardrails?: GuardrailReport;
  structuredOutput?: StructuredOutputInfo;
  /** `tool_call` (before execution) / `tool_result` (right after) — the live tool timeline's data source. `done` also carries the full `toolCalls` array as a reconciliation source of truth. */
  toolCall?: ToolCallStart;
  toolResult?: ToolCallInfo;
  toolCalls?: readonly ToolCallInfo[];
  /** Phase 6's analogue of `toolCall`/`toolResult` above — the live reasoning timeline's data source. `done` also carries the full `agentRun`. */
  agentPlan?: readonly string[];
  agentStep?: AgentStepStart;
  agentObservation?: AgentStepInfo;
  agentRun?: AgentRunInfo;
  /**
   * `graph_node_start`/`graph_node_end` are Phase 7's analogue of
   * `toolCall`/`toolResult` and `agentStep`/`agentObservation` above — the
   * live graph-visualization data source. `graph_interrupt` fires instead
   * of `done` when the run pauses for approval. `done` also carries the
   * full `graphRun` for reconciliation.
   */
  graphNode?: GraphNodeInfo;
  graphInterrupt?: PendingApprovalInfo;
  graphRun?: GraphRunInfo;
  /**
   * `agent_turn_start`/`agent_turn_end` are Phase 8's analogue of the live
   * per-step events above, one per specialist/coordinator visit. There's
   * no `_interrupt` counterpart — a multi-agent turn never pauses, so
   * `done` always follows and carries the full `multiAgentRun` for
   * reconciliation.
   */
  agentTurn?: MultiAgentTurnInfo;
  multiAgentRun?: MultiAgentRunInfo;
  /** Only on `done` when `useEvaluation` was set — no live metric SSE events. */
  evaluation?: EvaluationRunInfo;
  model?: string;
  usage?: ChatUsage;
  message?: string;
}

/**
 * The retrieval strategy switcher's UI state: which base strategy to run,
 * optional metadata filters, and the post-retrieval/query modifiers. Sent
 * with every chat request so the backend's Phase 2 pipeline knows what to
 * run instead of falling back to its server-configured defaults.
 */
export interface RetrievalSettings {
  strategy: RetrievalStrategy;
  category?: string;
  docType?: string;
  useMmr: boolean;
  useRerank: boolean;
  useCompression: boolean;
  useQueryExpansion: boolean;
}

/**
 * The prompt settings bar's UI state: which template/version to render the
 * prompt from, and the few-shot/structured-output toggles. Sent with every
 * chat request so the backend's Phase 4 registry knows what to use instead
 * of falling back to `PROMPT_DEFAULT_TEMPLATE_ID`.
 */
export interface PromptSettings {
  templateId: string;
  version?: number;
  useFewShot: boolean;
  structuredOutput: boolean;
}

/**
 * The tools settings bar's UI state: whether the model may call tools this
 * turn, and which registered tools are enabled. Sent with every chat
 * request so the backend's Phase 5 execute-loop knows whether to bind
 * tools at all instead of defaulting to `useTools: false`.
 *
 * `useAgent` (Phase 6) shares the same `enabledTools` list but opts into
 * the classic text-based ReAct loop instead — it wins if both are `true`.
 * `useGraph` (Phase 7) shares it too and wins over both — same precedence
 * the backend documents (`useGraph > useAgent > useTools`). `useMultiAgent`
 * (Phase 8) shares it too and wins over all three (`useMultiAgent >
 * useGraph > useAgent > useTools`), scoping which tools the `researcher`
 * specialist may call.
 */
export interface ToolSettings {
  useTools: boolean;
  /** Every known tool name currently enabled — an empty list here still means "use tools, but none enabled." */
  enabledTools: string[];
  useAgent: boolean;
  useGraph: boolean;
  useMultiAgent: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present once the response has started streaming/arrived. */
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
  memory?: MemoryInfo;
  promptInfo?: PromptInfo;
  guardrails?: GuardrailReport;
  structuredOutput?: StructuredOutputInfo;
  /** Live during streaming (populated as `tool_call`/`tool_result` events arrive), reconciled on `done`. */
  toolCalls?: readonly ToolCallDisplay[];
  /** Live during streaming (populated as the `agent_plan` event arrives), reconciled on `done`. */
  agentPlan?: readonly string[];
  /** Live during streaming (populated as `agent_thought`/`agent_observation` events arrive), reconciled on `done`. */
  agentSteps?: readonly AgentStepDisplay[];
  /** Live during streaming (populated as `graph_node_start`/`graph_node_end` events arrive), reconciled on `done`. */
  graphNodes?: readonly GraphNodeDisplay[];
  /** Set by `graph_interrupt`, cleared once `approveGraphRun()` resumes the turn. */
  pendingApproval?: PendingApprovalInfo;
  /** Live during streaming (populated as `agent_turn_start`/`agent_turn_end` events arrive), reconciled on `done`. */
  agentTurns?: readonly MultiAgentTurnDisplay[];
  /** Set once `done` carries a `multiAgentRun` — the dashboard/timeline/comparison views' data source for plan/research/draft/review history. */
  multiAgentRun?: MultiAgentRunInfo;
  /** Set once `done` carries `evaluation` (Phase 9) — scorecards / dashboard data source. */
  evaluation?: EvaluationRunInfo;
  usage?: ChatUsage;
  model?: string;
  /** Wall-clock time from request start to the `done` event, in ms. */
  latencyMs?: number;
  /** Wall-clock time from request start to the first streamed token, in ms. */
  firstTokenMs?: number;
  isStreaming?: boolean;
  error?: string;
}
