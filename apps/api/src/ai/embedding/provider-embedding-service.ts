import type { DocumentChunk } from '../knowledge/models/document-chunk.js';
import type { EmbeddingProvider } from '../providers/contracts/embedding-provider.js';
import type { EmbeddingResult } from './embedding-result.js';
import type { EmbeddingService } from './embedding-service.js';

/**
 * Generates embeddings using the configured provider.
 *
 * This service maps Atlas AI domain models to the provider contract.
 */
export class ProviderEmbeddingService implements EmbeddingService {
  constructor(private readonly provider: EmbeddingProvider) {}

  /**
   * Generate embeddings for document chunks.
   */
  public async embed(chunks: readonly DocumentChunk[]): Promise<readonly EmbeddingResult[]> {
    if (chunks.length === 0) {
      return [];
    }

    const vectors = await this.provider.embed(chunks.map((chunk) => chunk.content));

    const results: EmbeddingResult[] = [];

    for (const [index, vector] of vectors.entries()) {
      const chunk = chunks.at(index);

      if (chunk === undefined) {
        throw new Error(`Embedding response index ${index} has no matching input chunk.`);
      }

      results.push({
        input: chunk,
        vector,
      });
    }

    return results;
  }
}
