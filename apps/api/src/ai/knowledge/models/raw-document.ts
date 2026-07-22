/**
 * Represents a document exactly as it was loaded from the source.
 *
 * A loader is responsible only for retrieving raw content.
 * It does not parse frontmatter or understand markdown.
 */
export interface RawDocument {
  /**
   * Relative path used as the logical source identifier.
   *
   * Example:
   * knowledge/getting-started.md
   */
  source: string;

  /**
   * Absolute path on disk.
   */
  path: string;

  /**
   * Raw markdown content exactly as read from disk.
   */
  content: string;
}
