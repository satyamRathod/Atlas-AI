import type { DocumentMetadata } from './document-metadata.js';

/**
 * Canonical representation of a knowledge document
 * used throughout the ingestion pipeline.
 */
export interface KnowledgeDocument {
  /**
   * Stable document identifier.
   */
  id: string;

  /**
   * Relative source.
   */
  source: string;

  /**
   * Human readable title.
   */
  title: string;

  /**
   * Markdown content without frontmatter.
   */
  content: string;

  /**
   * Parsed metadata.
   */
  metadata: DocumentMetadata;
}
