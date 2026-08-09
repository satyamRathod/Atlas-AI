import type { Document } from '@langchain/core/documents';

export interface RankedList {
  documents: Document[];
  weight: number;
}

export interface FusedResult {
  document: Document;
  fusedScore: number;
}

/**
 * Reciprocal Rank Fusion (RRF) — merges several ranked lists using only
 * each item's *rank position*, not its raw score. This is the standard way
 * to combine retrievers whose scores live on incompatible scales (dense
 * cosine similarity is bounded [-1, 1]; BM25 is an unbounded, length-
 * normalized log-frequency weight) without having to calibrate/normalize
 * them against each other.
 *
 * `score += weight / (rank + k)` for each list a document appears in,
 * rank starting at 1. `k = 60` is the constant used across most production
 * hybrid-search implementations (Qdrant, Elasticsearch, LangChain's own
 * `EnsembleRetriever`) — high enough that a handful of positions of rank
 * difference doesn't dominate the fused score.
 */
export function reciprocalRankFusion(rankedLists: RankedList[], k = 60): FusedResult[] {
  const scores = new Map<string, number>();
  const documentsByKey = new Map<string, Document>();

  for (const { documents, weight } of rankedLists) {
    documents.forEach((document, index) => {
      const key = documentKey(document);
      const rank = index + 1;

      scores.set(key, (scores.get(key) ?? 0) + weight / (rank + k));

      if (!documentsByKey.has(key)) {
        documentsByKey.set(key, document);
      }
    });
  }

  return Array.from(documentsByKey.entries())
    .map(([key, document]) => ({ document, fusedScore: scores.get(key) ?? 0 }))
    .sort((a, b) => b.fusedScore - a.fusedScore);
}

/** Identifies "the same chunk" across retrievers by source + content. */
function documentKey(document: Document): string {
  return `${String(document.metadata.source ?? '')}::${document.pageContent}`;
}
