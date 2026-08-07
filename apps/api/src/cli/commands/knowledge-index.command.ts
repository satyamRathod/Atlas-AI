import { env } from '@/config/env.js';
import { createEmbeddings, embeddingConfiguration } from '@/langchain/embeddings/index.js';
import { KnowledgeIndexer } from '@/langchain/indexing/index.js';
import { loadKnowledgeDocuments } from '@/langchain/loaders/index.js';
import { createTextSplitter } from '@/langchain/splitters/index.js';
import {
  createQdrantVectorStore,
  QdrantCollectionService,
} from '@/langchain/vectorstores/index.js';

import type { Command } from '../command.js';

export class KnowledgeIndexCommand implements Command {
  public readonly name = 'knowledge:index';
  public readonly description = 'Load, chunk, embed, and index knowledge/*.md into Qdrant';

  public async execute(args: string[]): Promise<void> {
    const reset = args.includes('--reset');

    console.log('📚 Atlas AI Knowledge Indexing\n');

    const documents = await loadKnowledgeDocuments();
    console.log(`Loaded ${documents.length} document(s) from ${env.KNOWLEDGE_DIRECTORY}`);

    const embeddings = createEmbeddings();
    const collections = new QdrantCollectionService();

    if (reset) {
      console.log(`Resetting collection "${env.QDRANT_COLLECTION}"...`);
      await collections.recreateCollection(
        env.QDRANT_COLLECTION,
        embeddingConfiguration.dimensions,
      );
    } else {
      await collections.ensureCollection({
        name: env.QDRANT_COLLECTION,
        dimensions: embeddingConfiguration.dimensions,
      });
    }

    const vectorStore = await createQdrantVectorStore({ embeddings });
    const splitter = createTextSplitter();
    const indexer = new KnowledgeIndexer({ splitter, vectorStore });

    await indexer.index(documents);

    console.log('\n✅ Knowledge indexing completed.');
  }
}
