import OpenAI from 'openai';

import { ProviderEmbeddingService } from '@/ai/embeddings/provider-embedding-service.js';
import { TextChunker } from '@/ai/knowledge/chunker/text-chunker.js';
import { MarkdownLoader } from '@/ai/knowledge/loader/markdown-loader.js';
import { MarkdownParser } from '@/ai/knowledge/parser/markdown-parser.js';
import { OpenAIEmbeddingProvider } from '@/ai/providers/openai-embedding-provider.js';
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
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL,
  });

  const embeddingProvider = new OpenAIEmbeddingProvider({
    client,
    model: 'text-embedding-3-small',
  });

  return {
    loader: new MarkdownLoader(),
    parser: new MarkdownParser(),
    chunker: new TextChunker(),
    embeddingService: new ProviderEmbeddingService(embeddingProvider),
  };
}
