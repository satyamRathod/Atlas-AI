import type { ExecutionOptions } from './execution-options.js';
import type { ChatMessage } from './message.js';

export interface GenerateRequest {
  messages: ChatMessage[];
  options?: ExecutionOptions;
}
