import type { DocumentChunk } from '../knowledge/models/document-chunk.js';

/**
 * Result of embedding a document chunk.
 */
export interface EmbeddingResult {
  /**
   * Original input chunk.
   */
  input: DocumentChunk;

  /**
   * Dense vector returned by the embedding model.
   */
  vector: readonly number[];
}
