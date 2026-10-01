import type { Redis } from 'ioredis';

import { env } from '@/config/env.js';

import type {
  ObservabilityMetrics,
  ObservabilityMode,
  ObservabilityStageTiming,
  ObservabilityTurn,
} from '../observability.types.js';

const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_AGGREGATE_LIMIT = 200;

/**
 * Redis-backed per-turn observability store (§2 of
 * docs/phases/phase-10-observability.md) — mirrors
 * `RedisEvaluationStore`: one JSON blob per turn + a global sorted index,
 * plus a per-session sorted set for `sessionId` filters.
 */
export class RedisObservabilityStore {
  constructor(private readonly redis: Redis) {}

  public async saveTurn(turn: ObservabilityTurn): Promise<void> {
    if (!env.OBSERVABILITY_ENABLED) return;

    const key = this.turnKey(turn.turnId);
    const ttlSeconds = env.OBSERVABILITY_RUN_TTL_MINUTES * 60;
    const createdAtMs = Date.parse(turn.createdAt) || Date.now();

    const pipeline = this.redis.pipeline();
    pipeline.set(key, JSON.stringify(turn), 'EX', ttlSeconds);
    pipeline.zadd(this.indexKey(), createdAtMs, turn.turnId);
    pipeline.expire(this.indexKey(), ttlSeconds);
    pipeline.zadd(this.sessionIndexKey(turn.sessionId), createdAtMs, turn.turnId);
    pipeline.expire(this.sessionIndexKey(turn.sessionId), ttlSeconds);
    await pipeline.exec();
  }

  public async getTurn(turnId: string): Promise<ObservabilityTurn | undefined> {
    const raw = await this.redis.get(this.turnKey(turnId));
    if (!raw) return undefined;
    return JSON.parse(raw) as ObservabilityTurn;
  }

  public async listRecentTurns(options?: {
    limit?: number;
    sessionId?: string;
  }): Promise<ObservabilityTurn[]> {
    const limit = options?.limit ?? DEFAULT_LIST_LIMIT;
    const indexKey = options?.sessionId ? this.sessionIndexKey(options.sessionId) : this.indexKey();

    const ids = await this.redis.zrevrange(indexKey, 0, Math.max(0, limit - 1));
    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.get(this.turnKey(id));
    }
    const results = await pipeline.exec();

    const turns: ObservabilityTurn[] = [];
    for (const entry of results ?? []) {
      const raw = entry?.[1];
      if (typeof raw === 'string') {
        turns.push(JSON.parse(raw) as ObservabilityTurn);
      }
    }
    return turns;
  }

  /** In-process rollup over the newest `limit` turns (default 200). */
  public async aggregate(options?: { limit?: number }): Promise<ObservabilityMetrics> {
    const turns = await this.listRecentTurns({
      limit: options?.limit ?? DEFAULT_AGGREGATE_LIMIT,
    });

    const modeCounts = new Map<ObservabilityMode, number>();
    const stageTotals = new Map<string, { sum: number; count: number }>();
    let totalTokens = 0;
    let totalCostUsd = 0;
    let latencySum = 0;

    for (const turn of turns) {
      modeCounts.set(turn.mode, (modeCounts.get(turn.mode) ?? 0) + 1);
      if (turn.usage) totalTokens += turn.usage.total_tokens;
      if (turn.costUsd !== undefined) totalCostUsd += turn.costUsd;
      latencySum += turn.latency.totalMs;

      for (const stage of turn.retrieval.stages) {
        const bucket = stageTotals.get(stage.name) ?? { sum: 0, count: 0 };
        bucket.sum += stage.durationMs;
        bucket.count += 1;
        stageTotals.set(stage.name, bucket);
      }
    }

    const byMode = [...modeCounts.entries()]
      .map(([mode, count]) => ({ mode, count }))
      .sort((a, b) => b.count - a.count);

    const retrievalStageAvgMs: ObservabilityStageTiming[] = [...stageTotals.entries()].map(
      ([name, { sum, count }]) => ({
        name,
        durationMs: count === 0 ? 0 : Math.round(sum / count),
      }),
    );

    return {
      requestCount: turns.length,
      totalTokens,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      avgLatencyMs: turns.length === 0 ? 0 : Math.round(latencySum / turns.length),
      byMode,
      retrievalStageAvgMs,
      sampleSize: turns.length,
    };
  }

  private turnKey(turnId: string): string {
    return `${env.OBSERVABILITY_REDIS_PREFIX}turns:${turnId}`;
  }

  private indexKey(): string {
    return `${env.OBSERVABILITY_REDIS_PREFIX}turns:index`;
  }

  private sessionIndexKey(sessionId: string): string {
    return `${env.OBSERVABILITY_REDIS_PREFIX}session:${sessionId}`;
  }
}
