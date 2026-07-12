import { randomUUID } from 'node:crypto';

import type { ConversationStore } from '../contracts/conversation-store.js';
import { ChatSession } from '../domain/chat-session.js';

export class InMemoryConversationStore implements ConversationStore {
  private readonly sessions = new Map<string, ChatSession>();

  async create(): Promise<ChatSession> {
    const session = new ChatSession(randomUUID());

    this.sessions.set(session.id, session);

    return session;
  }

  async get(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async save(session: ChatSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
}
