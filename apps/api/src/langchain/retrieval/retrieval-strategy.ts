import type { MetadataFilter } from '@/langchain/retrievers/retriever.types.js';

export type RetrievalStrategy =
  | 'dense'
  | 'hybrid'
  | 'multi_query'
  | 'self_query'
  | 'parent_document';

export const RETRIEVAL_STRATEGIES: readonly RetrievalStrategy[] = [
  'dense',
  'hybrid',
  'multi_query',
  'self_query',
  'parent_document',
];

/** One stage of the retrieval pipeline, timed for the retrieval timeline. */
export interface RetrievalStageTiming {
  name: string;
  durationMs: number;
}

export interface AdvancedRetrieveOptions {
  strategy?: RetrievalStrategy | undefined;
  filter?: MetadataFilter | undefined;
  /** Only meaningful for `dense`/`hybrid` — always uses the dense vector store. */
  useMmr?: boolean | undefined;
  useRerank?: boolean | undefined;
  useCompression?: boolean | undefined;
  /** Only meaningful for `dense`/`hybrid`. */
  useQueryExpansion?: boolean | undefined;
}
