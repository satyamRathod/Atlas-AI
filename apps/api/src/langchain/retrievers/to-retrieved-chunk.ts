import { Document } from '@langchain/core/documents';

import type { RetrievedChunk } from './retriever.types.js';

/**
 * Maps a LangChain `Document` to our `RetrievedChunk` citation shape.
 *
 * `score` is read from `metadata.score`, which every retrieval stage in
 * this pipeline is expected to set (or overwrite) with *its own* notion of
 * relevance — cosine similarity for dense search, the fused RRF value for
 * hybrid search, a BM25 weight, or a cross-encoder logit. So a chunk's
 * displayed score reflects whichever stage last touched it, not always a
 * comparable cosine similarity. This is called out in the Phase 2 docs.
 */
export function toRetrievedChunk(document: Document): RetrievedChunk {
  return {
    content: document.pageContent,
    source: String(document.metadata.source ?? 'unknown'),
    ...(document.metadata.title ? { title: String(document.metadata.title) } : {}),
    score: typeof document.metadata.score === 'number' ? document.metadata.score : 0,
    ...(document.metadata.category ? { category: String(document.metadata.category) } : {}),
    ...(document.metadata.docType ? { docType: String(document.metadata.docType) } : {}),
  };
}

export function withScore(document: Document, score: number): Document {
  return new Document({
    pageContent: document.pageContent,
    metadata: { ...document.metadata, score },
    ...(document.id ? { id: document.id } : {}),
  });
}
