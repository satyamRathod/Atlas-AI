import type OpenAI from 'openai';
import type { Logger } from 'pino';

import { ProviderEmbeddingService } from '../embedding/provider-embedding-service.js';
import { OpenAIEmbeddingProvider } from '../providers/openai-embedding-provider.js';

export interface KernelOptions {
  client: OpenAI;

  logger: Logger;

  embeddingModel: string;
}

/**
 * Application composition root.
 *
 * Responsible for constructing shared infrastructure and exposing
 * application-wide dependencies.
 */
export class Kernel {
  /**
   * Embedding service used throughout the application.
   */
  public readonly embeddingService: ProviderEmbeddingService;

  constructor(options: KernelOptions) {
    const embeddingProvider = new OpenAIEmbeddingProvider({
      client: options.client,
      model: options.embeddingModel,
    });

    this.embeddingService = new ProviderEmbeddingService(embeddingProvider);
  }
}
