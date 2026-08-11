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

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  retrieval: RetrievalInfo;
  memory: MemoryInfo;
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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present once the response has started streaming/arrived. */
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
  memory?: MemoryInfo;
  usage?: ChatUsage;
  model?: string;
  /** Wall-clock time from request start to the `done` event, in ms. */
  latencyMs?: number;
  /** Wall-clock time from request start to the first streamed token, in ms. */
  firstTokenMs?: number;
  isStreaming?: boolean;
  error?: string;
}
