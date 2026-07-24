import type OpenAI from 'openai';

import type { DocumentChunk } from '../knowledge/models/document-chunk.js';
import type { EmbeddingResult } from './embedding-result.js';
import type { EmbeddingService } from './embedding-service.js';

/**
 * Embedding service backed by an OpenAI-compatible provider.
 */
export class ProviderEmbeddingService implements EmbeddingService {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  public async embed(chunks: readonly DocumentChunk[]): Promise<readonly EmbeddingResult[]> {
    if (chunks.length === 0) {
      return [];
    }

    const response = await this.client.embeddings.create({
      model: this.model,
      input: chunks.map((chunk) => chunk.content),
    });

    return response.data.map((embedding, index) => ({
      input: chunks[index]!,
      vector: embedding.embedding,
    }));
  }
}
