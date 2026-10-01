import type { Redis } from 'ioredis';

import { env } from '@/config/env.js';
import type { BenchmarkRunStore, BenchmarkRunSummary } from '@/langchain/evaluation/index.js';

/**
 * Redis-backed benchmark-run history (§4 of docs/phases/phase-9-evaluation.md)
 * — one JSON blob per run under `EVALUATION_REDIS_PREFIX + 'runs:' + runId`,
 * plus a sorted set (`…runs:index`) keyed by createdAt ms so
 * `listRecentRuns` can return newest-first without scanning every key.
 */
export class RedisEvaluationStore implements BenchmarkRunStore {
  constructor(private readonly redis: Redis) {}

  public async saveRun(summary: BenchmarkRunSummary): Promise<void> {
    const key = this.runKey(summary.runId);
    const ttlSeconds = env.EVALUATION_RUN_TTL_MINUTES * 60;
    const createdAtMs = Date.parse(summary.createdAt) || Date.now();

    const pipeline = this.redis.pipeline();
    pipeline.set(key, JSON.stringify(summary), 'EX', ttlSeconds);
    pipeline.zadd(this.indexKey(), createdAtMs, summary.runId);
    pipeline.expire(this.indexKey(), ttlSeconds);
    await pipeline.exec();
  }

  public async getRun(runId: string): Promise<BenchmarkRunSummary | undefined> {
    const raw = await this.redis.get(this.runKey(runId));
    if (!raw) return undefined;
    return JSON.parse(raw) as BenchmarkRunSummary;
  }

  /** Newest first. `limit` defaults to 20. */
  public async listRecentRuns(limit = 20): Promise<BenchmarkRunSummary[]> {
    const ids = await this.redis.zrevrange(this.indexKey(), 0, Math.max(0, limit - 1));
    if (ids.length === 0) return [];

    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.get(this.runKey(id));
    }
    const results = await pipeline.exec();

    const runs: BenchmarkRunSummary[] = [];
    for (const entry of results ?? []) {
      const raw = entry?.[1];
      if (typeof raw === 'string') {
        runs.push(JSON.parse(raw) as BenchmarkRunSummary);
      }
    }
    return runs;
  }

  private runKey(runId: string): string {
    return `${env.EVALUATION_REDIS_PREFIX}runs:${runId}`;
  }

  private indexKey(): string {
    return `${env.EVALUATION_REDIS_PREFIX}runs:index`;
  }
}
