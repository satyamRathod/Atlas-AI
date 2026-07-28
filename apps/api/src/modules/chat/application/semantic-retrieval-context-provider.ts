import type { Retriever } from '@/ai/retrieval/retriever.js';
import type { RetrievalContextProvider } from './retrieval-context-provider.js';
import type { RetrievedContext } from './retrieved-context.js';

export class SemanticRetrievalContextProvider implements RetrievalContextProvider {
  constructor(private readonly retriever: Retriever) {}

  public async getContext(question: string): Promise<RetrievedContext> {
    const results = await this.retriever.retrieve(question);
    console.log('Results:', results.length);
    for (const result of results) {
      console.log(`${result.score.toFixed(3)} -> ${result.payload.source}`);
    }
    return {
      chunks: results.map((result) => ({
        source: String(result.payload.source),
        index: Number(result.payload.index),
        score: result.score,
        content: String(result.payload.content),
      })),
    };
  }
}
