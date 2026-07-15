import type { GenerateRequest } from '../../../ai/types/generate-request.js';
import type { ChatSession } from '../domain/chat-session.js';

export class PromptBuilder {
  build(session: ChatSession): GenerateRequest {
    return {
      messages: session.getMessages(),
    };
  }
}
