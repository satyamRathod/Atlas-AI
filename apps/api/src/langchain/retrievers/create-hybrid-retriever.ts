import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';
import { matchesMetadataFilter, toQdrantFilter } from '@/langchain/retrieval/metadata-filter.js';
import { reciprocalRankFusion } from '@/langchain/retrieval/reciprocal-rank-fusion.js';

import type { Bm25Retriever } from './bm25-retriever.js';
import type {
  MetadataFilter,
  RetrievedChunk,
  RetrieveOptions,
  Retriever,
} from './retriever.types.js';
import { toRetrievedChunk, withScore } from './to-retrieved-chunk.js';

export interface CreateHybridRetrieverOptions {
  vectorStore: QdrantVectorStore;
  bm25Retriever: Bm25Retriever;
  denseWeight?: number;
  fetchK?: number;
  rrfK?: number;
}

/**
 * Hybrid search: runs dense (semantic) and BM25 (lexical) retrieval in
 * parallel over the full candidate pool (`fetchK` each), then fuses the two
 * ranked lists with Reciprocal Rank Fusion. This is what lets a query catch
 * both "meaning" matches (dense) and exact keyword/rare-term matches (BM25)
 * that embeddings can dilute.
 */
export function createHybridRetriever(options: CreateHybridRetrieverOptions): Retriever {
  const denseWeight = options.denseWeight ?? env.RETRIEVAL_HYBRID_DENSE_WEIGHT;
  const bm25Weight = 1 - denseWeight;
  const fetchK = options.fetchK ?? env.RETRIEVAL_FETCH_K;
  const rrfK = options.rrfK ?? env.RETRIEVAL_RRF_K;

  return {
    async retrieve(query: string, retrieveOptions?: RetrieveOptions): Promise<RetrievedChunk[]> {
      const filter: MetadataFilter | undefined = retrieveOptions?.filter;

      const [denseResults, bm25Documents] = await Promise.all([
        options.vectorStore.similaritySearchWithScore(query, fetchK, toQdrantFilter(filter)),
        options.bm25Retriever.invoke(query),
      ]);

      const denseDocuments = denseResults.map(([document, score]) => withScore(document, score));
      // BM25 runs over an in-memory corpus with no server-side filter support
      // (see bm25-retriever.ts), so metadata filtering is applied here instead.
      const filteredBm25Documents = bm25Documents.filter((document) =>
        matchesMetadataFilter(document.metadata, filter),
      );

      const fused = reciprocalRankFusion(
        [
          { documents: denseDocuments, weight: denseWeight },
          { documents: filteredBm25Documents, weight: bm25Weight },
        ],
        rrfK,
      );

      return fused
        .slice(0, env.RETRIEVAL_TOP_K)
        .map(({ document, fusedScore }) => toRetrievedChunk(withScore(document, fusedScore)));
    },
  };
}
