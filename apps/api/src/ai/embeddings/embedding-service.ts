import type { DocumentChunk } from '../knowledge/models/document-chunk.js';
import type { EmbeddingResult } from './embedding-result.js';

export interface EmbeddingService {
  embedDocuments(chunks: readonly DocumentChunk[]): Promise<readonly EmbeddingResult[]>;

  embedQuery(query: string): Promise<readonly number[]>;
}
