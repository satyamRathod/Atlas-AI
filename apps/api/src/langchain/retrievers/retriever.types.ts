/** A single retrieved knowledge chunk, ready to become a citation. */
export interface RetrievedChunk {
  content: string;
  source: string;
  title?: string;
  score: number;
  /** Topical category from `DOCUMENT_METADATA_BY_SOURCE` (e.g. "hr", "product"). */
  category?: string;
  /** Document type from `DOCUMENT_METADATA_BY_SOURCE` (e.g. "policy", "faq"). */
  docType?: string;
}

/**
 * Equality filter on chunk metadata (e.g. `{ category: "hr" }`). Applied by
 * strategies that support server-side filtering (dense, hybrid, MMR).
 * `self_query` derives this automatically from the natural-language query
 * instead of taking it as input.
 */
export interface MetadataFilter {
  [key: string]: string | number | boolean;
}

export interface RetrieveOptions {
  filter?: MetadataFilter | undefined;
}

export interface Retriever {
  retrieve(query: string, options?: RetrieveOptions): Promise<RetrievedChunk[]>;
}
