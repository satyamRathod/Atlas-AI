import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';

import type { EmbeddingProvider } from './contracts/embedding-provider.js';

export interface TransformersEmbeddingProviderOptions {
  model: string;
  batchSize?: number;
}

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  private extractor?: FeatureExtractionPipeline;

  constructor(private readonly options: TransformersEmbeddingProviderOptions) {}

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.extractor) {
      return this.extractor;
    }

    console.log(`📦 Loading embedding model '${this.options.model}'...`);

    this.extractor = await pipeline('feature-extraction', this.options.model);

    console.log('✅ Embedding model loaded');

    return this.extractor;
  }

  public async embed(input: readonly string[]): Promise<readonly (readonly number[])[]> {
    if (input.length === 0) {
      return [];
    }

    const extractor = await this.getExtractor();

    const batchSize = this.options.batchSize ?? 32;

    const vectors: number[][] = [];

    for (let i = 0; i < input.length; i += batchSize) {
      const batch = input.slice(i, i + batchSize);

      console.log(`Embedding batch ${i / batchSize + 1}/${Math.ceil(input.length / batchSize)}`);

      const output = await extractor(batch, {
        pooling: 'mean',
        normalize: true,
      });

      const dimensions = output.dims.at(-1);

      if (!dimensions) {
        throw new Error('Unable to determine embedding dimensions.');
      }

      const data = output.data;

      for (let offset = 0; offset < batch.length; offset++) {
        const start = offset * dimensions;
        const end = start + dimensions;

        vectors.push(Array.from(data.slice(start, end)));
      }
    }

    return vectors;
  }
}
