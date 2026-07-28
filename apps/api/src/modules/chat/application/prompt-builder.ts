import type { ContextWindowTrimmer } from '../../../ai/context/context-window-trimmer.js';
import type { TokenCounter } from '../../../ai/tokens/contracts/token-counter.js';
import type { TokenBudgetManager } from '../../../ai/tokens/token-budget-manager.js';
import type { GenerateRequest } from '../../../ai/types/generate-request.js';
import type { ChatSession } from '../domain/chat-session.js';
import type { ConversationSummarizer } from './conversation-summarizer.js';
import type { RetrievedContext } from './retrieved-context.js';

export class PromptBuilder {
  constructor(
    private readonly budgetManager: TokenBudgetManager,
    private readonly tokenCounter: TokenCounter,
    private readonly trimmer: ContextWindowTrimmer,
    private readonly summarizer: ConversationSummarizer,
  ) {}

  build(session: ChatSession, context: RetrievedContext): GenerateRequest {
    const originalMessages = session.getMessages();

    const tokenCount = this.tokenCounter.countMessages(originalMessages);

    // const budget = this.budgetManager.createBudget();

    let messages = originalMessages;

    if (!this.budgetManager.fits(tokenCount)) {
      const trimmed = this.trimmer.trim(originalMessages);

      const removedCount = originalMessages.length - trimmed.length;

      const removed = originalMessages.slice(0, removedCount);

      const summary = this.summarizer.summarize(removed);

      messages = [summary.summary, ...trimmed];
    }

    if (context.chunks.length > 0) {
      messages = [
        {
          role: 'system',
          content: this.buildKnowledgeSystemPrompt(context),
        },
        ...messages,
      ];
    }

    return {
      messages,
    };
  }

  private buildKnowledgeSystemPrompt(context: RetrievedContext): string {
    const documents = context.chunks
      .map((chunk, index) =>
        `
  [Document ${index + 1}]
  Source: ${chunk.source}
  Chunk: ${chunk.index}
  
  ${chunk.content}
  `.trim(),
      )
      .join('\n\n========================================\n\n');

    return `
  You are Atlas AI.
  
  You are answering questions using the provided knowledge base.
  
  Instructions:
  
  - Use ONLY the information contained in the knowledge base.
  - If multiple documents are relevant, combine the information.
  - If the answer cannot be found in the knowledge base, reply:
    "I don't have enough information in the current knowledge base."
  - Do not invent facts.
  - Do not rely on outside knowledge.
  - Keep answers concise unless the user asks for detail.
  
  Knowledge Base
  
  ${documents}
  `.trim();
  }
}
