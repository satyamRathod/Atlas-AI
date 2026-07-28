import type { RetrievedContext } from './retrieved-context.js';

export interface RetrievalContextProvider {
  getContext(question: string): Promise<RetrievedContext>;
}
