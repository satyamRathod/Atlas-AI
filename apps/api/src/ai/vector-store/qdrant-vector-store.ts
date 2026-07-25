import { QdrantClient } from '@qdrant/js-client-rest';

import type { VectorStore } from './vector-store.js';

export interface QdrantVectorStoreOptions {
  url: string;
}

export class QdrantVectorStore implements VectorStore {
  private readonly client: QdrantClient;

  constructor(options: QdrantVectorStoreOptions) {
    this.client = new QdrantClient({
      url: options.url,
    });
  }

  public async createCollection(collection: string, dimensions: number): Promise<void> {
    const exists = await this.client.collectionExists(collection);

    if (exists.exists) {
      return;
    }

    await this.client.createCollection(collection, {
      vectors: {
        size: dimensions,
        distance: 'Cosine',
      },
    });

    console.log(`✅ Created collection '${collection}'`);
  }
}
