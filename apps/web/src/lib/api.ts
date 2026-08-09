import type { ChatResponse, MetadataFilter, RetrievalSettings, StreamChunk } from '@/types/chat';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Builds the `filters` object from the strategy switcher's category/docType selects, dropping unset fields. */
function buildFilters(settings: RetrievalSettings): MetadataFilter | undefined {
  const filters: MetadataFilter = {};
  if (settings.category) filters.category = settings.category;
  if (settings.docType) filters.docType = settings.docType;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

export async function sendChatMessage(
  message: string,
  sessionId: string | undefined,
  settings: RetrievalSettings,
): Promise<ChatResponse> {
  const filters = buildFilters(settings);

  const res = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      ...(sessionId ? { sessionId } : {}),
      retrievalStrategy: settings.strategy,
      ...(filters ? { filters } : {}),
      useMmr: settings.useMmr,
      useRerank: settings.useRerank,
      useCompression: settings.useCompression,
      useQueryExpansion: settings.useQueryExpansion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Chat request failed with status ${res.status}`);
  }

  return res.json() as Promise<ChatResponse>;
}

export interface StreamChatHandlers {
  onCitations?: (chunk: StreamChunk) => void;
  onToken?: (chunk: StreamChunk) => void;
  onDone?: (chunk: StreamChunk) => void;
  onError?: (chunk: StreamChunk | { message: string }) => void;
}

/**
 * Opens a Server-Sent Events connection to the streaming chat endpoint.
 * The backend emits named events (`citations`, `token`, `done`, `error`)
 * over a plain GET request, which is exactly what the browser's native
 * `EventSource` API is built for — no hand-rolled fetch/ReadableStream
 * SSE parsing needed.
 *
 * `settings` carries the retrieval strategy switcher's state (strategy,
 * metadata filters, MMR/rerank/compression/query-expansion toggles) as
 * query params, matching `chatStreamQuerySchema` on the backend.
 *
 * Returns a cleanup function that closes the connection.
 */
export function streamChatMessage(
  message: string,
  sessionId: string | undefined,
  settings: RetrievalSettings,
  handlers: StreamChatHandlers,
): () => void {
  const params = new URLSearchParams({ message, retrievalStrategy: settings.strategy });
  if (sessionId) params.set('sessionId', sessionId);

  const filters = buildFilters(settings);
  if (filters) params.set('filters', JSON.stringify(filters));

  params.set('useMmr', String(settings.useMmr));
  params.set('useRerank', String(settings.useRerank));
  params.set('useCompression', String(settings.useCompression));
  params.set('useQueryExpansion', String(settings.useQueryExpansion));

  const source = new EventSource(`${API_BASE_URL}/api/v1/chat/stream?${params.toString()}`);

  const parse = (event: MessageEvent<string>): StreamChunk => JSON.parse(event.data) as StreamChunk;

  source.addEventListener('citations', (event) => {
    handlers.onCitations?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('token', (event) => {
    handlers.onToken?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('done', (event) => {
    handlers.onDone?.(parse(event as MessageEvent<string>));
    source.close();
  });

  source.addEventListener('error', (event) => {
    const messageEvent = event as MessageEvent<string>;
    if (messageEvent.data) {
      handlers.onError?.(parse(messageEvent));
    } else {
      handlers.onError?.({ message: 'Connection to the server was lost.' });
    }
    source.close();
  });

  return () => source.close();
}
