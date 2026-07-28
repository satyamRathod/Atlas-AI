import { QdrantClient } from '@qdrant/js-client-rest';

import type { SearchResult, VectorPoint, VectorStore } from './vector-store.js';

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

    console.log('Collection exists:', exists);

    if (exists.exists) {
      return;
    }

    console.log(`Creating collection '${collection}'...`);

    const result = await this.client.createCollection(collection, {
      vectors: {
        size: dimensions,
        distance: 'Cosine',
      },
    });

    console.log(result);
  }

  public async upsert(collection: string, points: readonly VectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }

    await this.client.upsert(collection, {
      wait: true,
      points: points.map((point) => ({
        id: point.id,
        vector: [...point.vector],
        payload: point.payload,
      })),
    });

    console.log(`Stored ${points.length} vectors`);
  }

  public async search(
    collection: string,
    vector: readonly number[],
    limit: number,
  ): Promise<readonly SearchResult[]> {
    const response = await this.client.query(collection, {
      query: [...vector],
      limit,
      with_payload: true,
    });

    return response.points.map((point) => ({
      score: point.score ?? 0,
      payload: (point.payload ?? {}) as Record<string, unknown>,
    }));
  }
}
