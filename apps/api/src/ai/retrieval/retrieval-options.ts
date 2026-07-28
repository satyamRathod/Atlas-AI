export interface RetrievalOptions {
  /**
   * Maximum number of vectors fetched from the vector store.
   */
  candidateLimit: number;

  /**
   * Minimum similarity score required.
   */
  minScore: number;

  /**
   * Maximum chunks passed to the LLM.
   */
  maxChunks: number;
}
