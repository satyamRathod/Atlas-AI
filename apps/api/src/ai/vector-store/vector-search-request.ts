import type { MetadataFilter } from './metadata-filter.js';

export interface VectorSearchRequest {
  /**
   * Query embedding.
   */
  vector: readonly number[];

  /**
   * Maximum candidates requested from the vector store.
   */
  limit: number;

  /**
   * Optional metadata filters.
   */
  filters?: readonly MetadataFilter[];
}
