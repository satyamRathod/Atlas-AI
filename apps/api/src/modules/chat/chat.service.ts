import { randomUUID } from 'node:crypto';

import type { LLMProvider } from '../../ai/contracts/llm-provider.js';
import type { StreamChunk } from '../../ai/types/stream-chunk.js';
import type { StreamOptions } from '../../ai/types/stream-options.js';
import type { PromptBuilder } from './application/prompt-builder.js';
import type { ChatRequestInput } from './chat.schema.js';
import type { ChatResponse } from './chat.types.js';
import type { ConversationStore } from './contracts/conversation-store.js';
import { ChatSession } from './domain/chat-session.js';

export class ChatService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly conversationStore: ConversationStore,
    private readonly promptBuilder: PromptBuilder,
  ) {}

  async execute(request: ChatRequestInput): Promise<ChatResponse> {
    const session = await this.getOrCreateSession(request.sessionId);

    session.addUserMessage(request.message);
    const response = await this.provider.generate(this.promptBuilder.build(session));

    session.addAssistantMessage(response.text);
    await this.conversationStore.save(session);

    return {
      sessionId: session.id,
      reply: response.text,
      model: response.model,
      ...(response.usage ? { usage: response.usage } : {}),
    };
  }

  async *stream({
    message,
    sessionId,
    options,
  }: {
    message: string;
    sessionId?: string;
    options?: StreamOptions;
  }): AsyncIterable<StreamChunk> {
    const session = await this.getOrCreateSession(sessionId);

    session.addUserMessage(message);

    let assistantResponse = '';

    for await (const chunk of this.provider.stream(this.promptBuilder.build(session), options)) {
      if (chunk.type === 'text') {
        assistantResponse += chunk.text;
      } else if (chunk.type === 'done') {
        session.addAssistantMessage(assistantResponse);
      }

      yield chunk;
    }

    await this.conversationStore.save(session);
  }

  private async getOrCreateSession(sessionId?: string): Promise<ChatSession> {
    if (sessionId) {
      const session = await this.conversationStore.get(sessionId);

      if (session) {
        return session;
      }
    }

    return new ChatSession(randomUUID());
  }
}
