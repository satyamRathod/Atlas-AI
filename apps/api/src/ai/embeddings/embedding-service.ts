import type { DocumentChunk } from '../knowledge/models/document-chunk.js';
import type { EmbeddingResult } from './embedding-result.js';

/**
 * Generates vector embeddings.
 */
export interface EmbeddingService {
  embed(chunks: readonly DocumentChunk[]): Promise<readonly EmbeddingResult[]>;
}
