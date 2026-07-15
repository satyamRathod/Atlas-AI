import type { ChatMessage } from '../../../modules/chat/domain/chat-message.js';
import type { TokenCounter } from '../contracts/token-counter.js';

export class SimpleTokenCounter implements TokenCounter {
  countMessage(message: ChatMessage): number {
    return this.countText(message.content);
  }

  countMessages(messages: readonly ChatMessage[]): number {
    return messages.reduce((total, message) => total + this.countMessage(message), 0);
  }

  countText(text: string): number {
    /**
     * Temporary estimation.
     *
     * ~1 token ≈ 4 characters.
     */
    return Math.ceil(text.length / 4);
  }
}
