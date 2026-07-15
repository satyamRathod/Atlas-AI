import type { TokenCounter } from '../../../ai/tokens/contracts/token-counter.js';
import type { TokenBudgetManager } from '../../../ai/tokens/token-budget-manager.js';
import type { GenerateRequest } from '../../../ai/types/generate-request.js';
import type { ChatSession } from '../domain/chat-session.js';

export class PromptBuilder {
  constructor(
    private readonly budgetManager: TokenBudgetManager,
    private readonly tokenCounter: TokenCounter,
  ) {}

  build(session: ChatSession): GenerateRequest {
    const messages = session.getMessages();

    const tokenCount = this.tokenCounter.countMessages(messages);

    const budget = this.budgetManager.createBudget();

    if (!this.budgetManager.fits(tokenCount)) {
      // next lesson
    }

    return {
      messages,
    };
  }
}
