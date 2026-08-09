import { useCallback, useEffect, useRef, useState } from 'react';

import { streamChatMessage } from '@/lib/api';
import type { ChatMessage, RetrievalSettings } from '@/types/chat';

const STORAGE_KEY = 'atlas.chat.v1';

interface PersistedState {
  sessionId?: string;
  messages: ChatMessage[];
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as PersistedState;
    return { sessionId: parsed.sessionId, messages: parsed.messages ?? [] };
  } catch {
    return { messages: [] };
  }
}

function createId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useChat() {
  const initial = useRef(loadPersistedState());
  const [messages, setMessages] = useState<ChatMessage[]>(initial.current.messages);
  const [sessionId, setSessionId] = useState<string | undefined>(initial.current.sessionId);
  const [isStreaming, setIsStreaming] = useState(false);
  const closeStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages }));
  }, [sessionId, messages]);

  useEffect(() => {
    return () => closeStreamRef.current?.();
  }, []);

  const updateAssistantMessage = useCallback(
    (id: string, patch: Partial<ChatMessage> | ((msg: ChatMessage) => Partial<ChatMessage>)) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, ...(typeof patch === 'function' ? patch(msg) : patch) } : msg,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    (content: string, retrievalSettings: RetrievalSettings) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      closeStreamRef.current?.();

      const userMessage: ChatMessage = { id: createId(), role: 'user', content: trimmed };
      const assistantId = createId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const startedAt = performance.now();
      let firstTokenAt: number | undefined;

      const close = streamChatMessage(trimmed, sessionId, retrievalSettings, {
        onCitations: (chunk) => {
          if (chunk.sessionId) setSessionId(chunk.sessionId);
          updateAssistantMessage(assistantId, {
            citations: chunk.citations,
            retrieval: chunk.retrieval,
          });
        },
        onToken: (chunk) => {
          if (firstTokenAt === undefined) {
            firstTokenAt = performance.now();
          }
          const firstTokenMs = firstTokenAt - startedAt;
          updateAssistantMessage(assistantId, (msg) => ({
            content: msg.content + (chunk.text ?? ''),
            firstTokenMs,
          }));
        },
        onDone: (chunk) => {
          updateAssistantMessage(assistantId, {
            isStreaming: false,
            usage: chunk.usage,
            model: chunk.model,
            latencyMs: performance.now() - startedAt,
          });
          setIsStreaming(false);
        },
        onError: (chunk) => {
          updateAssistantMessage(assistantId, {
            isStreaming: false,
            error: 'message' in chunk ? chunk.message : 'Something went wrong.',
          });
          setIsStreaming(false);
        },
      });

      closeStreamRef.current = close;
    },
    [isStreaming, sessionId, updateAssistantMessage],
  );

  const resetConversation = useCallback(() => {
    closeStreamRef.current?.();
    setMessages([]);
    setSessionId(undefined);
    setIsStreaming(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { messages, sessionId, isStreaming, sendMessage, resetConversation };
}
