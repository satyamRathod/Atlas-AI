import type OpenAI from 'openai';
import type { Logger } from 'pino';
import type { LLMProvider } from '../contracts/llm-provider.js';
import { mapGenerateRequestToOpenAI } from '../mappers/openai-request.mapper.js';
import { mapOpenAIResponse } from '../mappers/openai-response.mapper.js';
import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';

interface OpenAIProviderOptions {
  client: OpenAI;
  model: string;
  logger: Logger;
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly options: OpenAIProviderOptions) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const startedAt = performance.now();

    try {
      const sdkRequest = mapGenerateRequestToOpenAI(request, {
        model: this.options.model,
      });

      const sdkResponse = await this.options.client.responses.create(sdkRequest);

      const response = mapOpenAIResponse(sdkResponse);

      const durationMs = performance.now() - startedAt;

      this.options.logger.info(
        {
          provider: 'openai-compatible',
          model: response.model,
          durationMs: Math.round(durationMs),
          usage: response.usage,
        },
        'AI request completed',
      );

      return response;
    } catch (error) {
      const durationMs = performance.now() - startedAt;

      this.options.logger.error(
        {
          provider: 'openai-compatible',
          model: this.options.model,
          durationMs: Math.round(durationMs),
          error,
        },
        'AI request failed',
      );

      throw error;
    }
  }
}
