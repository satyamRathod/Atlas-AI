import type { UsageMetadata } from '@langchain/core/messages';

import type { AdvancedRetrieveOptions, RetrievalStageTiming } from '@/langchain/retrieval/index.js';

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

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  retrieval: RetrievalInfo;
  usage?: UsageMetadata;
}

export type StreamChunkType = 'citations' | 'token' | 'done' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  retrieval?: RetrievalInfo;
  model?: string;
  usage?: UsageMetadata;
  message?: string;
}
