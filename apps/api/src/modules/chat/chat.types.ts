import type { Usage } from '../../ai/types/usage.js';

export interface ChatRequest {
  message: string;
}

export interface ChatCitation {
  source: string;
  chunk: number;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  citations: readonly ChatCitation[];
  usage?: Usage;
}
