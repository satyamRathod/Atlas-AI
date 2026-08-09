import { QdrantClient } from '@qdrant/js-client-rest';

import { env } from '@/config/env.js';

export interface QdrantCollectionServiceOptions {
  client?: QdrantClient;
}

export interface VectorCollectionDefinition {
  name: string;
  dimensions: number;
}

export class QdrantCollectionService {
  private readonly client: QdrantClient;

  constructor(options: QdrantCollectionServiceOptions = {}) {
    this.client =
      options.client ??
      new QdrantClient({
        url: env.QDRANT_URL,
      });
  }

  public async collectionExists(collectionName: string): Promise<boolean> {
    const response = await this.client.collectionExists(collectionName);

    return response.exists;
  }

  public async createCollection(collectionName: string, vectorSize: number): Promise<void> {
    await this.client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
  }

  public async deleteCollection(collectionName: string): Promise<void> {
    await this.client.deleteCollection(collectionName);
  }

  public async ensureCollection({ name, dimensions }: VectorCollectionDefinition): Promise<void> {
    const exists = await this.collectionExists(name);

    if (exists) {
      return;
    }

    await this.createCollection(name, dimensions);
  }

  public async recreateCollection(collectionName: string, vectorSize: number): Promise<void> {
    const exists = await this.collectionExists(collectionName);

    if (exists) {
      await this.deleteCollection(collectionName);
    }

    await this.createCollection(collectionName, vectorSize);
  }

  public async getCollection(collectionName: string) {
    return this.client.getCollection(collectionName);
  }

  /**
   * Creates a payload index on a metadata field so Qdrant can filter on it
   * efficiently (metadata filtering / self-query). Optional for a corpus
   * this small — Qdrant filters unindexed fields with a full scan — but
   * this is what you'd do at scale, so it's included for completeness.
   */
  public async ensurePayloadIndex(
    collectionName: string,
    fieldName: string,
    fieldSchema: 'keyword' | 'integer' | 'float' | 'bool' = 'keyword',
  ): Promise<void> {
    await this.client.createPayloadIndex(collectionName, {
      field_name: fieldName,
      field_schema: fieldSchema,
    });
  }
}
