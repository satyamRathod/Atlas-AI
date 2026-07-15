import type { Usage } from '../../ai/types/usage.js';

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  model: string;
  usage?: Usage;
}
