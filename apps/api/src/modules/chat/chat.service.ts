import { randomUUID } from 'node:crypto';

import type { LLMProvider } from '../../ai/contracts/llm-provider.js';
import type { StreamOptions } from '../../ai/types/stream-options.js';
import type { ChatRequestInput } from './chat.schema.js';
import type { ChatResponse } from './chat.types.js';

export class ChatService {
  constructor(private readonly llm: LLMProvider) {}

  async execute(request: ChatRequestInput): Promise<ChatResponse> {
    const response = await this.llm.generate({
      messages: [
        {
          role: 'user',
          content: request.message,
        },
      ],
    });

    return {
      id: randomUUID(),
      reply: response.text,
      createdAt: new Date().toISOString(),
    };
  }

  async stream(message: string, options?: StreamOptions) {
    return this.llm.stream(
      {
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      },
      options,
    );
  }
}
