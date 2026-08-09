import { Document } from '@langchain/core/documents';

import { env } from '@/config/env.js';
import { createRedisClient } from '@/infrastructure/redis/index.js';

interface Bm25SnapshotChunk {
  pageContent: string;
  metadata: Record<string, unknown>;
}

/**
 * Persists the exact chunks `knowledge:index` split and embedded into
 * Qdrant, so `createBm25Retriever` (used by both the API server and the
 * `knowledge:search` CLI) reconstructs the *same* lexical corpus instead of
 * re-reading and re-splitting `knowledge/*.md` itself. This is what keeps
 * BM25 from drifting out of sync with the dense index.
 */
export async function saveBm25Corpus(chunks: Document[]): Promise<void> {
  const snapshot: Bm25SnapshotChunk[] = chunks.map((chunk) => ({
    pageContent: chunk.pageContent,
    metadata: chunk.metadata,
  }));

  const redis = createRedisClient();

  try {
    await redis.set(env.BM25_REDIS_KEY, JSON.stringify(snapshot));
  } finally {
    await redis.quit();
  }
}

/** Returns `null` if `knowledge:index` hasn't been run yet (key not set). */
export async function loadBm25Corpus(): Promise<Document[] | null> {
  const redis = createRedisClient();

  let raw: string | null;
  try {
    raw = await redis.get(env.BM25_REDIS_KEY);
  } finally {
    await redis.quit();
  }

  if (!raw) {
    return null;
  }

  const snapshot = JSON.parse(raw) as Bm25SnapshotChunk[];

  return snapshot.map(
    (chunk) => new Document({ pageContent: chunk.pageContent, metadata: chunk.metadata }),
  );
}
