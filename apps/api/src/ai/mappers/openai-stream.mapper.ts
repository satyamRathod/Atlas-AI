import type { ResponseStreamEvent } from 'openai/resources/responses/responses';
import type { StreamChunk } from '../types/stream-chunk.js';

export function mapOpenAIStreamEvent(event: ResponseStreamEvent): StreamChunk[] {
  switch (event.type) {
    case 'response.created':
      return [
        {
          type: 'start',
        },
      ];

    case 'response.output_text.delta':
      return [
        {
          type: 'text',
          text: event.delta,
        },
      ];

    case 'response.completed': {
      const usage = event.response.usage;

      if (usage) {
        return [
          {
            type: 'usage',
            usage: {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.total_tokens,
            },
          },
          {
            type: 'done',
          },
        ];
      }

      return [
        {
          type: 'done',
        },
      ];
    }

    default:
      return [];
  }
}
