import { TextChunker } from '../knowledge/chunker/text-chunker.js';
import { MarkdownLoader } from '../knowledge/loader/markdown-loader.js';
import { MarkdownParser } from '../knowledge/parser/markdown-parser.js';

/**
 * Composition root for the knowledge domain.
 *
 * This class owns the lifecycle of all knowledge-related services.
 */
export class KnowledgeModule {
  public readonly loader: MarkdownLoader;

  public readonly parser: MarkdownParser;

  public readonly chunker: TextChunker;

  constructor() {
    this.loader = new MarkdownLoader();
    this.parser = new MarkdownParser();
    this.chunker = new TextChunker();
  }
}
