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

    const results: EmbeddingResult[] = [];

    for (const [index, embedding] of response.data.entries()) {
      const chunk = chunks.at(index);

      if (chunk === undefined) {
        throw new Error(`Embedding response index ${index} has no matching input chunk.`);
      }

      results.push({
        input: chunk,
        vector: embedding.embedding,
      });
    }

    return results;
  }
}
