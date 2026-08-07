import { createEmbeddings } from './embeddings/index.js';
import { KnowledgeIndexer } from './indexing/knowledge-indexer.js';
import { createTextSplitter } from './splitters/index.js';
import { createQdrantVectorStore } from './vectorstores/index.js';

export async function createKnowledgeIndexer(): Promise<KnowledgeIndexer> {
  const splitter = createTextSplitter();

  const embeddings = createEmbeddings();

  const vectorStore = await createQdrantVectorStore({
    embeddings,
  });

  return new KnowledgeIndexer({
    splitter,
    vectorStore,
  });
}
