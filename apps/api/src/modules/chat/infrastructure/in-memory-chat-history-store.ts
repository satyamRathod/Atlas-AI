import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import type { BaseMessage } from '@langchain/core/messages';

/**
 * Keys LangChain's native `InMemoryChatMessageHistory` by session id.
 *
 * This is intentionally unbounded and process-local for Phase 1. Token
 * budgeting, trimming, summarization, and persistent/long-term memory are
 * covered in Phase 3 (Memory).
 */
export class InMemoryChatHistoryStore {
  private readonly histories = new Map<string, InMemoryChatMessageHistory>();

  public async getMessages(sessionId: string): Promise<BaseMessage[]> {
    return (await this.getOrCreate(sessionId).getMessages()) ?? [];
  }

  public async append(sessionId: string, ...messages: BaseMessage[]): Promise<void> {
    await this.getOrCreate(sessionId).addMessages(messages);
  }

  private getOrCreate(sessionId: string): InMemoryChatMessageHistory {
    let history = this.histories.get(sessionId);

    if (!history) {
      history = new InMemoryChatMessageHistory();
      this.histories.set(sessionId, history);
    }

    return history;
  }
}
