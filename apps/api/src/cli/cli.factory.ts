import OpenAI from 'openai';

import { ProviderEmbeddingService } from '@/ai/embeddings/provider-embedding-service.js';
import { TextChunker } from '@/ai/knowledge/chunker/text-chunker.js';
import { MarkdownLoader } from '@/ai/knowledge/loader/markdown-loader.js';
import { MarkdownParser } from '@/ai/knowledge/parser/markdown-parser.js';
import { TransformersEmbeddingProvider } from '@/ai/providers/transformers-embedding-provider.js';
import { env } from '@/config/index.js';
// import { logger } from '@/infrastructure/logger/index.js';

export interface CliServices {
  loader: MarkdownLoader;
  parser: MarkdownParser;
  chunker: TextChunker;
  embeddingService: ProviderEmbeddingService;
}

/**
 * Builds dependencies required by CLI commands.
 */
export function buildCli(): CliServices {
  const embeddingProvider = new TransformersEmbeddingProvider({
    model: env.LOCAL_EMBEDDING_MODEL,
  });

  return {
    loader: new MarkdownLoader(),
    parser: new MarkdownParser(),
    chunker: new TextChunker(),
    embeddingService: new ProviderEmbeddingService(embeddingProvider),
  };
}
