import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';
import { toQdrantFilter } from '@/langchain/retrieval/metadata-filter.js';

import type { RetrievedChunk, RetrieveOptions, Retriever } from './retriever.types.js';
import { toRetrievedChunk, withScore } from './to-retrieved-chunk.js';

export interface CreateMmrRetrieverOptions {
  vectorStore: QdrantVectorStore;
  k?: number;
  fetchK?: number;
  lambda?: number;
}

/**
 * Maximal Marginal Relevance — re-selects from the top candidates to
 * balance relevance against diversity, so results don't all restate the
 * same near-duplicate passage. `lambda` trades the two off (1 = pure
 * relevance/no diversity, 0 = max diversity).
 *
 * `maxMarginalRelevanceSearch` doesn't return similarity scores, so this
 * also runs a plain scored search over the same candidate pool and looks
 * up each selected chunk's original cosine similarity for citation display.
 */
export function createMmrRetriever(options: CreateMmrRetrieverOptions): Retriever {
  const k = options.k ?? env.RETRIEVAL_TOP_K;
  const fetchK = options.fetchK ?? env.RETRIEVAL_MMR_FETCH_K;
  const lambda = options.lambda ?? env.RETRIEVAL_MMR_LAMBDA;

  return {
    async retrieve(query: string, retrieveOptions?: RetrieveOptions): Promise<RetrievedChunk[]> {
      const filter = toQdrantFilter(retrieveOptions?.filter);

      const [scoredCandidates, selected] = await Promise.all([
        options.vectorStore.similaritySearchWithScore(query, fetchK, filter),
        options.vectorStore.maxMarginalRelevanceSearch(query, {
          k,
          fetchK,
          lambda,
          ...(filter ? { filter } : {}),
        }),
      ]);

      const scoreByContent = new Map(
        scoredCandidates.map(([document, score]) => [document.pageContent, score]),
      );

      return selected.map((document) =>
        toRetrievedChunk(withScore(document, scoreByContent.get(document.pageContent) ?? 0)),
      );
    },
  };
}
