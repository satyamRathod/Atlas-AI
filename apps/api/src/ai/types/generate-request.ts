import type { ChatMessage } from '../../modules/chat/domain/chat-message.js';
import type { ExecutionOptions } from './execution-options.js';

export interface GenerateRequest {
  messages: ChatMessage[];
  options?: ExecutionOptions;
}
