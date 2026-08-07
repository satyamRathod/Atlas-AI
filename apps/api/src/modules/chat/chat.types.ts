import type { UsageMetadata } from '@langchain/core/messages';

export interface StreamOptions {
  signal?: AbortSignal;
}

export interface ChatCitation {
  index: number;
  source: string;
  title?: string;
  score: number;
  snippet: string;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  usage?: UsageMetadata;
}

export type StreamChunkType = 'citations' | 'token' | 'done' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  model?: string;
  usage?: UsageMetadata;
  message?: string;
}
