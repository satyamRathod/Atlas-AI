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

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  retrieval: RetrievalInfo;
  usage?: ChatUsage;
}

export type StreamChunkType = 'citations' | 'token' | 'done' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
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
  usage?: ChatUsage;
  model?: string;
  /** Wall-clock time from request start to the `done` event, in ms. */
  latencyMs?: number;
  /** Wall-clock time from request start to the first streamed token, in ms. */
  firstTokenMs?: number;
  isStreaming?: boolean;
  error?: string;
}
