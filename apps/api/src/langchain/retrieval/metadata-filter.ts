import type { QdrantFilter } from '@langchain/qdrant';

import type { MetadataFilter } from '@/langchain/retrievers/retriever.types.js';

/**
 * Compiles an app-level equality filter (`{ category: "hr" }`) into
 * Qdrant's filter DSL (`must: [{ key, match: { value } }]`). Chunk metadata
 * is stored under the `metadata` payload key by `@langchain/qdrant`
 * (see `QdrantVectorStore`'s default `metadataPayloadKey`), so filter keys
 * are addressed as `metadata.<field>`.
 */
export function toQdrantFilter(filter: MetadataFilter | undefined): QdrantFilter | undefined {
  if (!filter || Object.keys(filter).length === 0) {
    return undefined;
  }

  return {
    must: Object.entries(filter).map(([key, value]) => ({
      key: `metadata.${key}`,
      match: { value },
    })),
  };
}

/** In-process equivalent of `toQdrantFilter`, applied to the BM25 branch. */
export function matchesMetadataFilter(
  metadata: Record<string, unknown>,
  filter: MetadataFilter | undefined,
): boolean {
  if (!filter) {
    return true;
  }

  return Object.entries(filter).every(([key, value]) => metadata[key] === value);
}
