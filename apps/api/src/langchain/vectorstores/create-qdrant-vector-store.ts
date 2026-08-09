import type { Embeddings } from '@langchain/core/embeddings';
import { QdrantVectorStore } from '@langchain/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';

import { env } from '@/config/env.js';

export interface CreateQdrantVectorStoreOptions {
  embeddings: Embeddings;
  /** Defaults to `QDRANT_COLLECTION`. Used to point at the separate
   * parent-document child-chunk collection (`KNOWLEDGE_PARENT_COLLECTION`). */
  collectionName?: string;
}

export async function createQdrantVectorStore({
  embeddings,
  collectionName,
}: CreateQdrantVectorStoreOptions): Promise<QdrantVectorStore> {
  const client = new QdrantClient({
    url: env.QDRANT_URL,
  });

  return QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: collectionName ?? env.QDRANT_COLLECTION,
  });
}
