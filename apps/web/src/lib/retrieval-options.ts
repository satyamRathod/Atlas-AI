import type { RetrievalSettings, RetrievalStrategy } from '@/types/chat';

export interface RetrievalStrategyOption {
  value: RetrievalStrategy;
  label: string;
  description: string;
  /** Dense/hybrid/multi-query accept a server-side `filter`; self-query derives its own and parent-document doesn't support one. */
  supportsFilters: boolean;
  /** MMR only re-selects over the dense vector store. */
  supportsMmr: boolean;
  /** Query expansion only rewrites the query fed into dense/hybrid search. */
  supportsQueryExpansion: boolean;
}

export const RETRIEVAL_STRATEGY_OPTIONS: readonly RetrievalStrategyOption[] = [
  {
    value: 'dense',
    label: 'Dense',
    description: 'Pure vector similarity search over embeddings.',
    supportsFilters: true,
    supportsMmr: true,
    supportsQueryExpansion: true,
  },
  {
    value: 'hybrid',
    label: 'Hybrid',
    description: 'Dense + BM25 lexical search, fused with Reciprocal Rank Fusion.',
    supportsFilters: true,
    supportsMmr: true,
    supportsQueryExpansion: true,
  },
  {
    value: 'multi_query',
    label: 'Multi-query',
    description: 'LLM rewrites the question into several variants over hybrid search.',
    supportsFilters: true,
    supportsMmr: false,
    supportsQueryExpansion: false,
  },
  {
    value: 'self_query',
    label: 'Self-query',
    description: 'LLM derives a metadata filter from your question automatically.',
    supportsFilters: false,
    supportsMmr: false,
    supportsQueryExpansion: false,
  },
  {
    value: 'parent_document',
    label: 'Parent document',
    description: 'Matches small chunks, returns their full parent document for context.',
    supportsFilters: false,
    supportsMmr: false,
    supportsQueryExpansion: false,
  },
];

/** Mirrors `DOCUMENT_METADATA_BY_SOURCE` in apps/api/src/langchain/loaders/create-knowledge-loader.ts. */
export const CATEGORY_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'hr', label: 'HR' },
  { value: 'product', label: 'Product' },
  { value: 'retail', label: 'Retail' },
  { value: 'general', label: 'General' },
];

export const DOC_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'policy', label: 'Policy' },
  { value: 'faq', label: 'FAQ' },
  { value: 'document', label: 'Document' },
];

/** Mirrors the backend's env defaults (`RETRIEVAL_STRATEGY=dense`, all modifier flags off). */
export const DEFAULT_RETRIEVAL_SETTINGS: RetrievalSettings = {
  strategy: 'dense',
  useMmr: false,
  useRerank: false,
  useCompression: false,
  useQueryExpansion: false,
};

export function getStrategyOption(strategy: RetrievalStrategy): RetrievalStrategyOption {
  return (
    RETRIEVAL_STRATEGY_OPTIONS.find((option) => option.value === strategy) ??
    RETRIEVAL_STRATEGY_OPTIONS[0]
  );
}
