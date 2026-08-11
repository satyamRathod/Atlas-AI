import {
  type AIMessage,
  type BaseMessage,
  type HumanMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  type StoredMessage,
} from '@langchain/core/messages';
import type { Redis } from 'ioredis';

import { env } from '@/config/env.js';

export interface LoadedMemory {
  messages: BaseMessage[];
  /** Empty string until the first summarization trigger fires (§5). */
  summary: string;
}

/**
 * Redis-backed replacement for Phase 1's `InMemoryChatHistoryStore` — see
 * docs/phases/phase-3-memory.md §2. Raw messages live in a Redis **list**
 * (one `RPUSH` per turn), not a JSON blob, specifically so summarization
 * (§5) can compact old ones out with an atomic `LTRIM` instead of a
 * read-modify-write. The rolling summary lives in a separate string key.
 *
 * Takes an already-connected `Redis` client — the API server holds one
 * open for its lifetime (see `createRedisClient()`'s doc comment).
 */
export class RedisChatMemoryStore {
  constructor(private readonly redis: Redis) {}

  public async load(sessionId: string): Promise<LoadedMemory> {
    const [rawMessages, summary] = await Promise.all([
      this.redis.lrange(this.messagesKey(sessionId), 0, -1),
      this.redis.get(this.summaryKey(sessionId)),
    ]);

    const stored = rawMessages.map((json) => JSON.parse(json) as StoredMessage);

    return {
      messages: mapStoredMessagesToChatMessages(stored),
      summary: summary ?? '',
    };
  }

  /** Appends the newest turn verbatim and refreshes both keys' TTL — a
   * sliding window, so active sessions never expire mid-use (§2). */
  public async appendTurn(sessionId: string, human: HumanMessage, ai: AIMessage): Promise<void> {
    const stored = mapChatMessagesToStoredMessages([human, ai]);
    const messagesKey = this.messagesKey(sessionId);

    const pipeline = this.redis.pipeline();
    for (const message of stored) {
      pipeline.rpush(messagesKey, JSON.stringify(message));
    }
    pipeline.expire(messagesKey, env.MEMORY_HISTORY_TTL_SECONDS);
    pipeline.expire(this.summaryKey(sessionId), env.MEMORY_HISTORY_TTL_SECONDS);
    await pipeline.exec();
  }

  /**
   * Persists an updated rolling summary and atomically drops everything
   * from the raw list except the most recent `keepLastN` messages — the
   * actual mechanism that keeps a long-running session's Redis footprint
   * and token cost bounded over time (§5 step 4).
   */
  public async compact(sessionId: string, keepLastN: number, summary: string): Promise<void> {
    const messagesKey = this.messagesKey(sessionId);

    const pipeline = this.redis.pipeline();
    pipeline.set(this.summaryKey(sessionId), summary, 'EX', env.MEMORY_HISTORY_TTL_SECONDS);

    if (keepLastN > 0) {
      // LTRIM key -0 -1 would (surprisingly) keep everything, not empty
      // the list — hence the explicit DEL branch below for keepLastN <= 0.
      pipeline.ltrim(messagesKey, -keepLastN, -1);
    } else {
      pipeline.del(messagesKey);
    }

    await pipeline.exec();
  }

  private messagesKey(sessionId: string): string {
    return `${env.MEMORY_HISTORY_REDIS_PREFIX}:${sessionId}`;
  }

  private summaryKey(sessionId: string): string {
    return `${env.MEMORY_SUMMARY_REDIS_PREFIX}:${sessionId}`;
  }
}
