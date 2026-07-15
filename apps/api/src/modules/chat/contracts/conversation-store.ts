import type { ChatSession } from '../domain/chat-session.js';

export interface ConversationStore {
  get(sessionId: string): Promise<ChatSession | null>;
  save(session: ChatSession): Promise<void>;
}
