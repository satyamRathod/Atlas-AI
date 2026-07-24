import type { DocumentMetadata } from './document-metadata.js';

/**
 * Represents a searchable chunk produced from a knowledge document.
 *
 * Chunks are the unit stored in the vector database and retrieved
 * during Retrieval-Augmented Generation (RAG).
 */
export interface DocumentChunk {
  /**
   * Stable unique identifier for this chunk.
   */
  id: string;

  /**
   * Parent document identifier.
   */
  documentId: string;

  /**
   * Relative source of the parent document.
   *
   * Example:
   * knowledge/getting-started.md
   */
  source: string;

  /**
   * Zero-based position within the parent document.
   */
  index: number;

  /**
   * Chunk text.
   */
  content: string;

  /**
   * Inclusive start offset within the original document.
   */
  startOffset: number;

  /**
   * Exclusive end offset within the original document.
   */
  endOffset: number;

  /**
   * Metadata inherited from the parent document.
   */
  metadata: DocumentMetadata;
}
