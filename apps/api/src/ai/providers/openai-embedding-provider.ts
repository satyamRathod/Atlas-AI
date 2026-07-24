import type OpenAI from 'openai';

import type { EmbeddingProvider } from './contracts/embedding-provider.js';

export interface OpenAIEmbeddingProviderOptions {
  client: OpenAI;

  model: string;
}

/**
 * Embedding provider backed by the OpenAI-compatible Embeddings API.
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly options: OpenAIEmbeddingProviderOptions) {}

  public async embed(input: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (input.length === 0) {
      return [];
    }

    const response = await this.options.client.embeddings.create({
      model: this.options.model,
      input: input.map((text) => text),
    });

    return response.data.map((item) => item.embedding);
  }
}
