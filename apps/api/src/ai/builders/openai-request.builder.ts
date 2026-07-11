import type {
  ResponseCreateParamsNonStreaming,
  ResponseCreateParamsStreaming,
} from 'openai/resources/responses/responses';

import type { GenerateRequest } from '../types/generate-request.js';

interface OpenAIRequestBuilderOptions {
  request: GenerateRequest;
  model: string;
}

export class OpenAIRequestBuilder {
  private readonly request: GenerateRequest;
  private readonly model: string;

  constructor({ request, model }: OpenAIRequestBuilderOptions) {
    this.request = request;
    this.model = model;
  }

  build(): ResponseCreateParamsNonStreaming {
    const request: ResponseCreateParamsNonStreaming = {
      model: this.model,
      input: this.buildInput(),
    };

    this.applyGenerationOptions(request);

    return request;
  }

  buildStream(): ResponseCreateParamsStreaming {
    const request: ResponseCreateParamsStreaming = {
      model: this.model,
      input: this.buildInput(),
      stream: true,
    };

    this.applyGenerationOptions(request);

    return request;
  }

  private buildInput() {
    return this.request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  private applyGenerationOptions(
    request: ResponseCreateParamsNonStreaming | ResponseCreateParamsStreaming,
  ) {
    if (this.request.options?.temperature) {
      request.temperature = this.request.options.temperature;
    }

    if (this.request.options?.maxOutputTokens) {
      request.max_output_tokens = this.request.options.maxOutputTokens;
    }
  }
}
