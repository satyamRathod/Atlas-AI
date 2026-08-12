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
  usage?: ChatUsage;
}

export type StreamChunkType = 'citations' | 'token' | 'done' | 'error';

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
  usage?: ChatUsage;
  model?: string;
  /** Wall-clock time from request start to the `done` event, in ms. */
  latencyMs?: number;
  /** Wall-clock time from request start to the first streamed token, in ms. */
  firstTokenMs?: number;
  isStreaming?: boolean;
  error?: string;
}
