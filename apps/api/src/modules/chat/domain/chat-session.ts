import type { ChatMessage } from './chat-message.js';

export class ChatSession {
  constructor(
    public readonly id: string,
    private readonly messages: ChatMessage[] = [],
    public readonly createdAt: Date = new Date(),
    private updatedAt: Date = new Date(),
  ) {}

  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
    });

    this.updatedAt = new Date();
  }

  addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content,
    });

    this.updatedAt = new Date();
  }

  getMessages(): readonly ChatMessage[] {
    return this.messages;
  }

  getLastMessage(): ChatMessage | undefined {
    return this.messages.at(-1);
  }

  get messageCount(): number {
    return this.messages.length;
  }

  get lastUpdatedAt(): Date {
    return this.updatedAt;
  }
}
