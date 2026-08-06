import { type FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { Embeddings } from '@langchain/core/embeddings';

export interface TransformersEmbeddingsOptions {
  model: string;
}

export class TransformersEmbeddings extends Embeddings {
  private extractorPromise: Promise<Awaited<ReturnType<typeof pipeline>>>;

  constructor(private readonly options: TransformersEmbeddingsOptions) {
    super({});

    this.extractorPromise = pipeline('feature-extraction', this.options.model);
  }

  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.embed(text);
  }

  private async embed(text: string): Promise<number[]> {
    const extractor = (await this.extractorPromise) as FeatureExtractionPipeline;

    const output = await extractor(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  }
}
