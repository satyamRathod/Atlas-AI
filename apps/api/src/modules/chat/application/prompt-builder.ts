import type { ContextWindowTrimmer } from '../../../ai/context/context-window-trimmer.js';
import type { TokenCounter } from '../../../ai/tokens/contracts/token-counter.js';
import type { TokenBudgetManager } from '../../../ai/tokens/token-budget-manager.js';
import type { GenerateRequest } from '../../../ai/types/generate-request.js';
import type { ChatSession } from '../domain/chat-session.js';
import type { ConversationSummarizer } from './conversation-summarizer.js';

export class PromptBuilder {
  constructor(
    private readonly budgetManager: TokenBudgetManager,
    private readonly tokenCounter: TokenCounter,
    private readonly trimmer: ContextWindowTrimmer,
    private readonly summarizer: ConversationSummarizer,
  ) {}

  build(session: ChatSession): GenerateRequest {
    const originalMessages = session.getMessages();

    const tokenCount = this.tokenCounter.countMessages(originalMessages);

    const budget = this.budgetManager.createBudget();

    let messages = originalMessages;

    if (!this.budgetManager.fits(tokenCount)) {
      const trimmed = this.trimmer.trim(originalMessages);

      const removedCount = originalMessages.length - trimmed.length;

      const removed = originalMessages.slice(0, removedCount);

      const summary = this.summarizer.summarize(removed);

      messages = [summary.summary, ...trimmed];
    }

    return {
      messages,
    };
  }
}
