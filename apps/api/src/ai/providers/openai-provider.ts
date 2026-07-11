import type OpenAI from 'openai';
import type { Logger } from 'pino';
import { OpenAIRequestBuilder } from '../builders/openai-request.builder.js';
import type { LLMProvider } from '../contracts/llm-provider.js';
import { mapOpenAIResponse } from '../mappers/openai-response.mapper.js';
import { mapOpenAIStreamEvent } from '../mappers/openai-stream.mapper.js';
import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';
import type { StreamChunk } from '../types/stream-chunk.js';

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
      const sdkRequest = new OpenAIRequestBuilder({
        request,
        model: this.options.model,
      }).build();

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

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const sdkRequest = new OpenAIRequestBuilder({
      request,
      model: this.options.model,
    }).buildStream();

    const stream = await this.options.client.responses.create(sdkRequest);

    for await (const event of stream) {
      const chunks = mapOpenAIStreamEvent(event);

      for (const chunk of chunks) {
        yield chunk;
      }
    }
  }
}
