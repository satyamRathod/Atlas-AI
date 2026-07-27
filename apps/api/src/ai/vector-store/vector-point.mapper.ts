import { createHash } from 'node:crypto';
import type { EmbeddingResult } from '@/ai/embeddings/index.js';
import type { VectorPoint } from './vector-store.js';

export function toVectorPoint(embedding: EmbeddingResult): VectorPoint {
  return {
    id: hashToUuid(embedding.input.id),
    vector: embedding.vector,
    payload: {
      documentId: embedding.input.documentId,
      source: embedding.input.source,
      index: embedding.input.index,
      content: embedding.input.content,
      metadata: embedding.input.metadata,
    },
  };
}

function hashToUuid(hash: string): string {
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}
