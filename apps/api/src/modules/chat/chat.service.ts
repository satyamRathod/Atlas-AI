import { randomUUID } from 'node:crypto';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  type AIMessageChunk,
  type BaseMessage,
  HumanMessage,
} from '@langchain/core/messages';
import type { Runnable } from '@langchain/core/runnables';
import { concat } from '@langchain/core/utils/stream';

import { env } from '@/config/env.js';
import { ragPrompt } from '@/langchain/prompts/index.js';
import type { RetrievedChunk, Retriever } from '@/langchain/retrievers/index.js';

import type { ChatRequestInput } from './chat.schema.js';
import type { ChatCitation, ChatResponse, StreamChunk, StreamOptions } from './chat.types.js';
import type { InMemoryChatHistoryStore } from './infrastructure/in-memory-chat-history-store.js';

interface RagChainInput {
  context: string;
  history: BaseMessage[];
  question: string;
}

export class ChatService {
  /** LCEL chain: prompt template piped into the active chat model provider. */
  private readonly chain: Runnable<RagChainInput, AIMessageChunk>;

  constructor(
    private readonly chatModel: BaseChatModel,
    private readonly retriever: Retriever,
    private readonly historyStore: InMemoryChatHistoryStore,
  ) {
    this.chain = ragPrompt.pipe(this.chatModel);
  }

  public async invoke(request: ChatRequestInput): Promise<ChatResponse> {
    const sessionId = request.sessionId ?? randomUUID();

    const [history, chunks] = await Promise.all([
      this.historyStore.getMessages(sessionId),
      this.retriever.retrieve(request.message),
    ]);

    const response = await this.chain.invoke({
      context: this.buildContext(chunks),
      history,
      question: request.message,
    });

    await this.historyStore.append(
      sessionId,
      new HumanMessage(request.message),
      new AIMessage(response.text),
    );

    return {
      sessionId,
      reply: response.text,
      model: env.GROQ_MODEL,
      citations: this.toCitations(chunks),
      ...(response.usage_metadata ? { usage: response.usage_metadata } : {}),
    };
  }

  public async *stream({
    message,
    sessionId,
    options,
  }: {
    message: string;
    sessionId?: string;
    options?: StreamOptions;
  }): AsyncIterable<StreamChunk> {
    const sid = sessionId ?? randomUUID();

    const [history, chunks] = await Promise.all([
      this.historyStore.getMessages(sid),
      this.retriever.retrieve(message),
    ]);

    const citations = this.toCitations(chunks);

    yield { type: 'citations', sessionId: sid, citations };

    let fullText = '';
    let aggregated: AIMessage | undefined;

    const streamIterable = await this.chain.stream(
      {
        context: this.buildContext(chunks),
        history,
        question: message,
      },
      options?.signal ? { signal: options.signal } : {},
    );

    for await (const part of streamIterable) {
      aggregated = aggregated ? concat(aggregated, part) : part;

      if (part.text) {
        fullText += part.text;
        yield { type: 'token', sessionId: sid, text: part.text };
      }
    }

    await this.historyStore.append(sid, new HumanMessage(message), new AIMessage(fullText));

    yield {
      type: 'done',
      sessionId: sid,
      model: env.GROQ_MODEL,
      ...(aggregated?.usage_metadata ? { usage: aggregated.usage_metadata } : {}),
    };
  }

  private buildContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant context was found in the knowledge base.';
    }

    return chunks
      .map((chunk, i) => `[${i + 1}] (source: ${chunk.source})\n${chunk.content}`)
      .join('\n\n');
  }

  private toCitations(chunks: RetrievedChunk[]): ChatCitation[] {
    return chunks.map((chunk, i) => ({
      index: i + 1,
      source: chunk.source,
      ...(chunk.title ? { title: chunk.title } : {}),
      score: chunk.score,
      snippet: chunk.content.length > 200 ? `${chunk.content.slice(0, 200)}…` : chunk.content,
    }));
  }
}
