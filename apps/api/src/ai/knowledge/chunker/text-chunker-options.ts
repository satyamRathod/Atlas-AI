/**
 * Configuration for the TextChunker.
 */
export interface TextChunkerOptions {
  /**
   * Maximum size of each chunk in characters.
   */
  chunkSize: number;

  /**
   * Number of overlapping characters between consecutive chunks.
   */
  chunkOverlap: number;
}

/**
 * Default configuration.
 */
export const DEFAULT_TEXT_CHUNKER_OPTIONS = {
  chunkSize: 800,
  chunkOverlap: 150,
} as const satisfies TextChunkerOptions;
