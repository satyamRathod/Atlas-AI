import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';

export interface RetrievedChunk {
  content: string;
  source: string;
  title?: string;
  score: number;
}

export interface Retriever {
  retrieve(query: string): Promise<RetrievedChunk[]>;
}

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
    async retrieve(query: string): Promise<RetrievedChunk[]> {
      const results = await vectorStore.similaritySearchWithScore(query, env.RETRIEVAL_TOP_K);

      return results
        .filter(([, score]) => score >= env.RETRIEVAL_SCORE_THRESHOLD)
        .map(([document, score]) => ({
          content: document.pageContent,
          source: String(document.metadata.source ?? 'unknown'),
          ...(document.metadata.title ? { title: String(document.metadata.title) } : {}),
          score,
        }));
    },
  };
}
