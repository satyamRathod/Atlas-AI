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
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  usage?: ChatUsage;
}

export type StreamChunkType = 'citations' | 'token' | 'done' | 'error';

export interface StreamChunk {
  type: StreamChunkType;
  sessionId?: string;
  text?: string;
  citations?: readonly ChatCitation[];
  model?: string;
  usage?: ChatUsage;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Present once the response has started streaming/arrived. */
  citations?: readonly ChatCitation[];
  usage?: ChatUsage;
  model?: string;
  /** Wall-clock time from request start to the `done` event, in ms. */
  latencyMs?: number;
  /** Wall-clock time from request start to the first streamed token, in ms. */
  firstTokenMs?: number;
  isStreaming?: boolean;
  error?: string;
}
