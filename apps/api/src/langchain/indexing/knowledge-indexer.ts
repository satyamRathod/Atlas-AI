import type { Document } from '@langchain/core/documents';
import type { QdrantVectorStore } from '@langchain/qdrant';
import type { TextSplitter } from '@langchain/textsplitters';
import { env } from '@/config/env.js';

export interface KnowledgeIndexerOptions {
  splitter: TextSplitter;
  vectorStore: QdrantVectorStore;
}

export class KnowledgeIndexer {
  constructor(private readonly options: KnowledgeIndexerOptions) {}

  public async index(documents: Document[]): Promise<void> {
    const chunks = await this.options.splitter.splitDocuments(documents);

    for (let i = 0; i < chunks.length; i += env.INDEX_BATCH_SIZE) {
      const batch = chunks.slice(i, i + env.INDEX_BATCH_SIZE);
      await this.options.vectorStore.addDocuments(batch);
    }
  }
}
