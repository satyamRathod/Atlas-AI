import type { Document } from '@langchain/core/documents';
import type { QdrantVectorStore } from '@langchain/qdrant';

import { env } from '@/config/env.js';

export interface KnowledgeIndexerOptions {
  vectorStore: QdrantVectorStore;
}

export class KnowledgeIndexer {
  constructor(private readonly options: KnowledgeIndexerOptions) {}

  /**
   * Batches and embeds already-split chunks into the vector store. Splitting
   * happens once, upstream (see `knowledge-index.command.ts`), so the same
   * chunk array can also be persisted as the BM25 corpus without risking the
   * two indexes drifting apart.
   */
  public async index(chunks: Document[]): Promise<void> {
    for (let i = 0; i < chunks.length; i += env.INDEX_BATCH_SIZE) {
      const batch = chunks.slice(i, i + env.INDEX_BATCH_SIZE);
      await this.options.vectorStore.addDocuments(batch);
    }
  }
}
