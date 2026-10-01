import { RedisSaver } from '@langchain/langgraph-checkpoint-redis';

import { env } from '@/config/env.js';

/**
 * Redis-backed checkpointer for the Phase 8 supervisor graph (§1 of
 * docs/phases/phase-8-multi-agent.md) — the same Redis instance every
 * prior phase already reuses, but a separate `RedisSaver` instance (and
 * TTL) from Phase 7's graph checkpointer. `MultiAgentRunner` also namespaces
 * its `thread_id` as `magent:{sessionId}` (not just the bare `sessionId`
 * Phase 7 uses), so the two graphs' checkpoints can never collide even for
 * the same chat session — kept deliberately separate rather than sharing
 * Phase 7's instance, matching the "each phase stays self-contained"
 * convention already used for every other phase-specific knob.
 */
export async function createMultiAgentCheckpointer(): Promise<RedisSaver> {
  return RedisSaver.fromUrl(env.REDIS_URL, {
    defaultTTL: env.MULTI_AGENT_CHECKPOINT_TTL_MINUTES,
    refreshOnRead: true,
  });
}
