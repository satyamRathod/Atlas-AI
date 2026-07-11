import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';

import type { GenerateRequest } from '../types/generate-request.js';

interface OpenAIRequestMapperOptions {
  model: string;
}

export function mapGenerateRequestToOpenAI(
  request: GenerateRequest,
  options: OpenAIRequestMapperOptions,
): ResponseCreateParamsNonStreaming {
  return {
    model: options.model,

    input: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),

    temperature: request.options?.temperature ?? null,

    max_output_tokens: request.options?.maxOutputTokens ?? null,

    stream: false,
  };
}
