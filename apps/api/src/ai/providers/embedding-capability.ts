/**
 * Embedding capability exposed by an AI provider.
 */
export interface EmbeddingCapability {
  /**
   * Generates dense vectors for the supplied texts.
   *
   * The returned vectors preserve the order of the input.
   */
  embed(input: readonly string[]): Promise<readonly (readonly number[])[]>;
}
