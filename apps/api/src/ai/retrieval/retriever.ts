import type { SearchResult } from '@/ai/vector-store/vector-store.js';

export interface Retriever {
  retrieve(query: string, limit?: number): Promise<readonly SearchResult[]>;
}
