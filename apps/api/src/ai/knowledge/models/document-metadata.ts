/**
 * Metadata extracted from markdown frontmatter.
 */
export interface DocumentMetadata {
  /**
   * Document author.
   */
  author?: string;

  /**
   * Document category.
   */
  category?: string;

  /**
   * Searchable tags.
   */
  tags?: string[];

  /**
   * Creation date.
   */
  createdAt?: Date;

  /**
   * Last updated date.
   */
  updatedAt?: Date;
}
