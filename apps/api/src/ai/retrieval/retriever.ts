import type { SearchResult } from '../vector-store/vector-store.js';
import type { SearchOptions } from './search-options.js';

export interface Retriever {
  retrieve(query: string, options?: SearchOptions): Promise<readonly SearchResult[]>;
}
