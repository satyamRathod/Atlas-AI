import { Document } from '@langchain/core/documents';
import { InMemoryStore } from '@langchain/core/stores';

import { env } from '@/config/env.js';
import { createRedisClient } from '@/infrastructure/redis/index.js';

interface ParentDocSnapshotEntry {
  id: string;
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * Persists every parent document currently in `docstore` to Redis as a
 * single JSON snapshot keyed by `doc_id` — the same
 * "ingest once via CLI, connect at boot" pattern used for the BM25 corpus
 * (see `../bm25-corpus-store.ts`).
 */
export async function saveParentDocstore(docstore: InMemoryStore<Document>): Promise<void> {
  const ids: string[] = [];
  for await (const key of docstore.yieldKeys()) {
    ids.push(key);
  }

  const documents = await docstore.mget(ids);
  const snapshot: ParentDocSnapshotEntry[] = ids.map((id, i) => ({
    id,
    pageContent: documents[i]?.pageContent ?? '',
    metadata: documents[i]?.metadata ?? {},
  }));

  const redis = createRedisClient();
  try {
    await redis.set(env.PARENT_DOCSTORE_REDIS_KEY, JSON.stringify(snapshot));
  } finally {
    await redis.quit();
  }
}

/**
 * Rebuilds an `InMemoryStore` from the Redis snapshot. Returns `null` if
 * `knowledge:index --target=parent-child` hasn't been run yet (key not set).
 */
export async function loadParentDocstore(): Promise<InMemoryStore<Document> | null> {
  const redis = createRedisClient();

  let raw: string | null;
  try {
    raw = await redis.get(env.PARENT_DOCSTORE_REDIS_KEY);
  } finally {
    await redis.quit();
  }

  if (!raw) {
    return null;
  }

  const snapshot = JSON.parse(raw) as ParentDocSnapshotEntry[];
  const docstore = new InMemoryStore<Document>();

  await docstore.mset(
    snapshot.map(({ id, pageContent, metadata }) => [id, new Document({ pageContent, metadata })]),
  );

  return docstore;
}
