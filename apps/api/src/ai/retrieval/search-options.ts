import type { MetadataFilter } from '../vector-store/metadata-filter.js';

export interface SearchOptions {
  /**
   * Override default candidate limit.
   */
  limit?: number;

  /**
   * Restrict retrieval to matching metadata.
   */
  filters?: readonly MetadataFilter[];
}
