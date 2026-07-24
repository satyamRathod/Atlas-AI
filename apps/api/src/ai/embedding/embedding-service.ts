import type { DocumentChunk } from '../knowledge/models/document-chunk.js';
import type { EmbeddedChunk } from './embedding-model.js';

/**
 * Contract implemented by all embedding providers.
 */
export interface EmbeddingService {
  /**
   * Generates embeddings for one or more chunks.
   *
   * Providers should internally batch requests whenever possible.
   */
  embed(chunks: readonly DocumentChunk[]): Promise<readonly EmbeddedChunk[]>;
}
