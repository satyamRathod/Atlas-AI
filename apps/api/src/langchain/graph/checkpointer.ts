import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';

import { env } from '@/config/env.js';

/**
 * Redis-backed checkpointer (§1/§3 of docs/phases/phase-7-langgraph.md) —
 * the same Redis instance Phases 2–4 already reuse for the BM25 corpus,
 * parent-document docstore, chat history/summaries, and prompt registry.
 * This is what makes `interrupt()`/resume real: a paused run's full graph
 * state survives even if the HTTP connection that started it is long
 * closed, and even across an API process restart.
 *
 * `RedisSaver.fromUrl()` creates its own `redis` (node-redis) client and
 * RediSearch-backed indexes on first use — separate from the `ioredis`
 * client the rest of the app uses for plain key/value access
 * (`infrastructure/redis/create-redis-client.ts`), since this package only
 * speaks to `node-redis`.
 */
export async function createGraphCheckpointer(): Promise<RedisSaver> {
  return RedisSaver.fromUrl(env.REDIS_URL, {
    defaultTTL: env.GRAPH_CHECKPOINT_TTL_MINUTES,
    refreshOnRead: true,
  });
}
