/**
 * Provider capable of generating embedding vectors.
 */
export interface EmbeddingProvider {
  /**
   * Generates embedding vectors for the supplied text.
   *
   * The returned vectors preserve the same order as the input.
   */
  embed(input: readonly string[]): Promise<readonly (readonly number[])[]>;
}
