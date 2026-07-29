import type { EmbeddingService } from '@/ai/embeddings/embedding-service.js';
import type { SearchOptions } from '@/ai/retrieval/search-options.js';
import type { SearchResult, VectorStore } from '@/ai/vector-store/vector-store.js';
import type { RetrievalOptions } from './retrieval-options.js';
import type { Retriever } from './retriever.js';

export interface SemanticRetrieverOptions {
  collection: string;
  embeddingService: EmbeddingService;
  vectorStore: VectorStore;
  retrieval: RetrievalOptions;
}

export class SemanticRetriever implements Retriever {
  constructor(private readonly options: SemanticRetrieverOptions) {}

  public async retrieve(query: string, options?: SearchOptions): Promise<readonly SearchResult[]> {
    const vector = await this.options.embeddingService.embedQuery(query);

    const candidates = await this.options.vectorStore.search(this.options.collection, {
      vector,
      limit: options?.limit ?? this.options.retrieval.candidateLimit,
      filters: options?.filters,
    });

    return candidates
      .filter((candidate) => candidate.score >= this.options.retrieval.minScore)
      .slice(0, this.options.retrieval.maxChunks);
  }
}
