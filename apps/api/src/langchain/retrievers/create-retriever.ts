import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';
import { toQdrantFilter } from '@/langchain/retrieval/metadata-filter.js';
import type { RetrievedChunk, RetrieveOptions, Retriever } from './retriever.types.js';
import { toRetrievedChunk, withScore } from './to-retrieved-chunk.js';

/**
 * Retrieval wrapper around `QdrantVectorStore.similaritySearchWithScore`.
 *
 * We use the raw scored search here (instead of `vectorStore.asRetriever()`)
 * because we need similarity scores to power citations and score-threshold
 * filtering. The native `.asRetriever()` contract is demonstrated separately
 * in the `knowledge:search` CLI command.
 */
export function createRetriever(vectorStore: QdrantVectorStore): Retriever {
  return {
    async retrieve(query: string, options?: RetrieveOptions): Promise<RetrievedChunk[]> {
      const results = await vectorStore.similaritySearchWithScore(
        query,
        env.RETRIEVAL_TOP_K,
        toQdrantFilter(options?.filter),
      );

      return results
        .filter(([, score]) => score >= env.RETRIEVAL_SCORE_THRESHOLD)
        .map(([document, score]) => toRetrievedChunk(withScore(document, score)));
    },
  };
}
