import type { ChatMessage } from '../../../modules/chat/domain/chat-message.js';

export interface TokenCounter {
  countMessage(message: ChatMessage): number;

  countMessages(messages: readonly ChatMessage[]): number;

  countText(text: string): number;
}
