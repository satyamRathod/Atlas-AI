import type { LLMProvider } from '../contracts/llm-provider.js';
import type { GenerateRequest } from '../types/generate-request.js';
import type { GenerateResponse } from '../types/generate-response.js';
import type { StreamChunk } from '../types/stream-chunk.js';

export class EchoProvider implements LLMProvider {
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const lastMessage = request.messages.at(-1);

    return {
      text: `Echo: ${lastMessage?.content ?? ''}`,
      model: 'echo',
    };
  }

  async *stream(request: GenerateRequest): AsyncIterable<StreamChunk> {
    const lastMessage = request.messages.at(-1);

    const response = `Echo: ${lastMessage?.content ?? ''}`;

    for (const character of response) {
      yield {
        type: 'text',
        text: character,
      };
    }

    yield {
      type: 'done',
    };
  }
}
