import { Redis } from 'ioredis';

import { env } from '@/config/env.js';

/**
 * Creates a new Redis connection. Callers own the connection's lifecycle —
 * short-lived scripts (e.g. `knowledge:index`) should `.quit()` it when
 * done; long-lived processes (the API server) can hold onto it.
 */
export function createRedisClient(): Redis {
  return new Redis(env.REDIS_URL, {
    // Fail fast with a clear error instead of retrying forever when Redis
    // is unreachable — callers decide whether/how to handle it.
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
}
