import { createHash } from 'node:crypto';

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import type { DocumentChunk, KnowledgeDocument } from '../models/index.js';
import { DEFAULT_TEXT_CHUNKER_OPTIONS, type TextChunkerOptions } from './text-chunker-options.js';

/**
 * Splits knowledge documents into searchable chunks.
 *
 * This class wraps LangChain's RecursiveCharacterTextSplitter so
 * Atlas AI is not coupled directly to LangChain APIs.
 */
export class TextChunker {
  private readonly splitter: RecursiveCharacterTextSplitter;

  constructor(options: Partial<TextChunkerOptions> = {}) {
    const config = {
      ...DEFAULT_TEXT_CHUNKER_OPTIONS,
      ...options,
    };

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
  }

  /**
   * Split a knowledge document into chunks.
   */
  public async chunk(document: KnowledgeDocument): Promise<readonly DocumentChunk[]> {
    const contents = await this.splitter.splitText(document.content);

    return contents.map((content, index) => ({
      id: this.createChunkId(document.id, index),

      documentId: document.id,

      source: document.source,

      index,

      content,

      metadata: document.metadata,
    }));
  }

  /**
   * Creates a deterministic chunk identifier.
   */
  private createChunkId(documentId: string, index: number): string {
    return createHash('sha256').update(`${documentId}:${index}`).digest('hex');
  }
}
