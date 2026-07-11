import type { Response } from 'openai/resources/responses/responses';

import type { GenerateResponse } from '../types/generate-response.js';

export function mapOpenAIResponse(response: Response): GenerateResponse {
  const generateResponse: GenerateResponse = {
    text: response.output_text,
    model: response.model,
  };

  if (response.usage) {
    generateResponse.usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      totalTokens: response.usage.total_tokens,
    };
  }

  return generateResponse;
}
