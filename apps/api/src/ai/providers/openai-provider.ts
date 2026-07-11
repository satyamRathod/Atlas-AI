import type OpenAI from 'openai';

import type { LLMProvider } from '../contracts/llm-provider.js';
import { mapGenerateRequestToOpenAI } from '../mappers/openai-request.mapper.js';
import { mapOpenAIResponse } from '../mappers/openai-response.mapper.js';
import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';

interface OpenAIProviderOptions {
  client: OpenAI;
  model: string;
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly options: OpenAIProviderOptions) {}

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const sdkRequest = mapGenerateRequestToOpenAI(request, {
      model: this.options.model,
    });

    try {
      const sdkResponse = await this.options.client.responses.create(sdkRequest);

      return mapOpenAIResponse(sdkResponse);
    } catch (error) {
      console.error('===== OPENAI ERROR =====');
      console.dir(error, { depth: null });

      throw error;
    }
  }
}
