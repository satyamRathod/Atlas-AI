/**
 * Configuration used by the TextChunker.
 */
export interface TextChunkerOptions {
  /**
   * Maximum number of characters allowed in a chunk.
   */
  chunkSize: number;

  /**
   * Number of overlapping characters between neighbouring chunks.
   */
  chunkOverlap: number;
}

/**
 * Default chunking configuration.
 *
 * These values provide a good balance for most embedding models.
 */
export const DEFAULT_TEXT_CHUNKER_OPTIONS: Readonly<TextChunkerOptions> = {
  chunkSize: 800,
  chunkOverlap: 150,
};
