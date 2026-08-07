import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGroq } from '@langchain/groq';

import { env } from '@/config/env.js';

/**
 * Chat model factory, dispatched by `CHAT_PROVIDER`.
 *
 * Every LangChain chat model integration implements the same `BaseChatModel`
 * contract, so the rest of the app (see `modules/chat/chat.service.ts`)
 * never needs to know which provider is active. Adding a new provider is:
 *
 * 1. `pnpm --filter @atlas/api add @langchain/openai` (or `@langchain/google-genai`, etc.)
 * 2. Add its value to the `CHAT_PROVIDER` enum in `config/env.ts` and its
 *    own env vars (e.g. `OPENAI_API_KEY`, `OPENAI_MODEL`).
 * 3. Add a `case` below constructing that provider's chat model.
 *
 * No other code changes needed.
 */
export function createChatModel(): BaseChatModel {
  switch (env.CHAT_PROVIDER) {
    case 'groq':
      return new ChatGroq({
        apiKey: env.GROQ_API_KEY,
        model: env.GROQ_MODEL,
        temperature: env.GROQ_TEMPERATURE,
        streaming: true,
      });
    default: {
      const unsupported: never = env.CHAT_PROVIDER;
      throw new Error(`Unsupported CHAT_PROVIDER: ${unsupported}`);
    }
  }
}
