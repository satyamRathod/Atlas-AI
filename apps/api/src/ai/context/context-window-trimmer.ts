import type { ChatMessage } from '../../modules/chat/domain/chat-message.js';
import type { TokenCounter } from '../tokens/contracts/token-counter.js';
import type { TokenBudgetManager } from '../tokens/token-budget-manager.js';

interface ContextWindowTrimmerOptions {
  tokenCounter: TokenCounter;
  tokenBudgetManager: TokenBudgetManager;
}

export class ContextWindowTrimmer {
  constructor(private readonly options: ContextWindowTrimmerOptions) {}

  trim(messages: readonly ChatMessage[]): readonly ChatMessage[] {
    const trimmed = [...messages];

    while (
      trimmed.length > 0 &&
      !this.options.tokenBudgetManager.fits(this.options.tokenCounter.countMessages(trimmed))
    ) {
      this.removeOldestConversationTurn(trimmed);
    }

    return trimmed;
  }

  private removeOldestConversationTurn(messages: ChatMessage[]): void {
    // Skip system messages
    while (messages[0]?.role === 'system') {
      return;
    }

    // Remove first user message
    if (messages[0]?.role === 'user') {
      messages.shift();
    }

    // Remove matching assistant reply
    if (messages[0]?.role === 'assistant') {
      messages.shift();
    }
  }
}
