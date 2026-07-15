import type { TokenBudgetManager } from '../../../ai/tokens/token-budget-manager.js';
import type { GenerateRequest } from '../../../ai/types/generate-request.js';
import type { ChatSession } from '../domain/chat-session.js';

export class PromptBuilder {
  constructor(private readonly tokenBudgetManager: TokenBudgetManager) {}

  build(session: ChatSession): GenerateRequest {
    const budget = this.tokenBudgetManager.createBudget();
    console.log(budget);
    return {
      messages: session.getMessages(),
    };
  }
}
