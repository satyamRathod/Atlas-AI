import type { Usage } from './usage.js';

export interface GenerateResponse {
  text: string;
  model: string;
  finishReason?: string;
  usage?: Usage;
}
