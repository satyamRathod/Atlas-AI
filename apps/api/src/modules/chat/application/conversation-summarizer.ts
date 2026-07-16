import type { ChatMessage } from '../domain/chat-message.js';

export interface ConversationSummary {
  summary: ChatMessage;
}

export class ConversationSummarizer {
  summarize(messages: readonly ChatMessage[]): ConversationSummary {
    const summaryText = messages.map((message) => `${message.role}: ${message.content}`).join('\n');

    return {
      summary: {
        role: 'system',
        content: ['Conversation summary:', summaryText].join('\n'),
      },
    };
  }
}
