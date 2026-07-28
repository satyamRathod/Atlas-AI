import { randomUUID } from 'node:crypto';
import type { LLMProvider } from '../../ai/contracts/llm-provider.js';
import type { StreamChunk } from '../../ai/types/stream-chunk.js';
import type { StreamOptions } from '../../ai/types/stream-options.js';
import type { PromptBuilder } from './application/prompt-builder.js';
import type { RetrievalContextProvider } from './application/retrieval-context-provider.js';
import type { ChatRequestInput } from './chat.schema.js';
import type { ChatResponse } from './chat.types.js';
import type { ConversationStore } from './contracts/conversation-store.js';
import { ChatSession } from './domain/chat-session.js';

export class ChatService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly conversationStore: ConversationStore,
    private readonly promptBuilder: PromptBuilder,
    private readonly contextProvider: RetrievalContextProvider,
  ) {}

  async execute(request: ChatRequestInput): Promise<ChatResponse> {
    const session = await this.getOrCreateSession(request.sessionId);

    session.addUserMessage(request.message);
    const context = await this.contextProvider.getContext(request.message);

    const prompt = this.promptBuilder.build(session, context);

    const response = await this.provider.generate(prompt);

    session.addAssistantMessage(response.text);
    await this.conversationStore.save(session);

    return {
      sessionId: session.id,
      reply: response.text,
      model: response.model,
      citations: context.chunks.map((chunk) => ({
        source: chunk.source,
        chunk: chunk.index,
      })),
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

    const context = await this.contextProvider.getContext(message);

    const prompt = this.promptBuilder.build(session, context);

    for await (const chunk of this.provider.stream(prompt, options)) {
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
