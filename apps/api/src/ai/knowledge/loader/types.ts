/**
 * Represents a raw document loaded from a knowledge source.
 *
 * This is intentionally simple.
 *
 * At this stage we only care about:
 *  - unique id
 *  - display title
 *  - original content
 *
 * Chunking, embeddings and metadata are added
 * in later stages of the RAG pipeline.
 */
export interface LoadedDocument {
  /**
   * Unique identifier.
   * Currently the filename.
   *
   * Example:
   * refund-policy.md
   */
  id: string;

  /**
   * Human readable title.
   *
   * Example:
   * refund-policy
   */
  title: string;

  /**
   * Entire document content.
   */
  content: string;
  source: string;
}
