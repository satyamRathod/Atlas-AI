import type { EmbeddingResult } from '../../embeddings/embedding-result.js';
import type { DocumentChunk, KnowledgeDocument } from '../models/index.js';

/**
 * Result produced by the knowledge ingestion workflow.
 *
 * This object represents the output of every stage in the ingestion
 * pipeline before anything is persisted into a vector database.
 */
export interface KnowledgeIngestionResult {
  /**
   * Parsed knowledge documents.
   */
  readonly documents: readonly KnowledgeDocument[];

  /**
   * Generated document chunks.
   */
  readonly chunks: readonly DocumentChunk[];

  /**
   * Generated embeddings for every chunk.
   */
  readonly embeddings: readonly EmbeddingResult[];
}
