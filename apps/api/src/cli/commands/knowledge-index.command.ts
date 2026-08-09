import { env } from '@/config/env.js';
import { createEmbeddings, embeddingConfiguration } from '@/langchain/embeddings/index.js';
import { KnowledgeIndexer } from '@/langchain/indexing/index.js';
import { loadKnowledgeDocuments } from '@/langchain/loaders/index.js';
import { buildParentDocumentRetriever, saveBm25Corpus } from '@/langchain/retrievers/index.js';
import { createTextSplitter } from '@/langchain/splitters/index.js';
import {
  createQdrantVectorStore,
  QdrantCollectionService,
} from '@/langchain/vectorstores/index.js';

import type { Command } from '../command.js';

/**
 * `--target=main` (default) indexes `knowledge/*.md` into the flat dense
 * collection used by the `dense`/`hybrid`/`multi_query`/`self_query`
 * strategies, and persists the same chunks as the BM25 lexical corpus (in
 * Redis) that hybrid search reads at query time. `--target=parent-child`
 * (re)builds the separate parent-document collection instead (see
 * `langchain/retrievers/parent-document/create-parent-document-retriever.ts`).
 */
export class KnowledgeIndexCommand implements Command {
  public readonly name = 'knowledge:index';
  public readonly description =
    'Load, chunk, embed, and index knowledge/*.md into Qdrant (--target=main|parent-child)';

  public async execute(args: string[]): Promise<void> {
    const reset = args.includes('--reset');
    const target = args.find((arg) => arg.startsWith('--target='))?.split('=')[1] ?? 'main';

    console.log('📚 Atlas AI Knowledge Indexing\n');

    if (target === 'parent-child') {
      await this.indexParentChild(reset);
      return;
    }

    if (target !== 'main') {
      console.log(`Unknown --target="${target}". Expected "main" or "parent-child".`);
      return;
    }

    await this.indexMain(reset);
  }

  private async indexMain(reset: boolean): Promise<void> {
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
    const chunks = await splitter.splitDocuments(documents);

    const indexer = new KnowledgeIndexer({ vectorStore });
    await indexer.index(chunks);
    console.log(
      `Indexed ${chunks.length} chunk(s) into Qdrant collection "${env.QDRANT_COLLECTION}"`,
    );

    console.log(`Persisting BM25 corpus (${chunks.length} chunk(s)) to Redis...`);
    await saveBm25Corpus(chunks);

    console.log('\n✅ Knowledge indexing completed (main collection + BM25 corpus).');
  }

  private async indexParentChild(reset: boolean): Promise<void> {
    console.log(`(Re)building parent-document collection "${env.KNOWLEDGE_PARENT_COLLECTION}"...`);

    const embeddings = createEmbeddings();
    await buildParentDocumentRetriever({ embeddings, reset });

    console.log('\n✅ Parent-document indexing completed.');
  }
}
