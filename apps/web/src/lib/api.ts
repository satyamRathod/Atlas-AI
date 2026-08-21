import type {
  ChatResponse,
  GraphNodeInfo,
  MetadataFilter,
  PromptSettings,
  RetrievalSettings,
  StreamChunk,
  ToolSettings,
} from '@/types/chat';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Builds the `filters` object from the strategy switcher's category/docType selects, dropping unset fields. */
function buildFilters(settings: RetrievalSettings): MetadataFilter | undefined {
  const filters: MetadataFilter = {};
  if (settings.category) filters.category = settings.category;
  if (settings.docType) filters.docType = settings.docType;
  return Object.keys(filters).length > 0 ? filters : undefined;
}

/** Adds the prompt settings bar's fields (Phase 4) — all optional on the wire, so an unset `PromptSettings` behaves like the server's own defaults. */
function buildPromptFields(promptSettings?: PromptSettings) {
  if (!promptSettings) return {};

  return {
    ...(promptSettings.templateId ? { promptTemplateId: promptSettings.templateId } : {}),
    ...(promptSettings.version !== undefined ? { promptVersion: promptSettings.version } : {}),
    useFewShot: promptSettings.useFewShot,
    structuredOutput: promptSettings.structuredOutput,
  };
}

/**
 * Adds the tools settings bar's fields (Phase 5, extended for Phase 6's
 * `useAgent` and Phase 7's `useGraph`). `enabledTools: []` means "all
 * registered tools" — omitted on the wire so the backend's own default
 * applies.
 */
function buildToolFields(toolSettings?: ToolSettings) {
  if (!toolSettings) return {};

  return {
    useTools: toolSettings.useTools,
    ...(toolSettings.enabledTools.length > 0 ? { enabledTools: toolSettings.enabledTools } : {}),
    useAgent: toolSettings.useAgent,
    useGraph: toolSettings.useGraph,
  };
}

export async function sendChatMessage(
  message: string,
  sessionId: string | undefined,
  settings: RetrievalSettings,
  promptSettings?: PromptSettings,
  toolSettings?: ToolSettings,
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
      ...buildPromptFields(promptSettings),
      ...buildToolFields(toolSettings),
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
  onToolCall?: (chunk: StreamChunk) => void;
  onToolResult?: (chunk: StreamChunk) => void;
  onAgentPlan?: (chunk: StreamChunk) => void;
  onAgentThought?: (chunk: StreamChunk) => void;
  onAgentObservation?: (chunk: StreamChunk) => void;
  onGraphNodeStart?: (chunk: StreamChunk) => void;
  onGraphNodeEnd?: (chunk: StreamChunk) => void;
  onGraphInterrupt?: (chunk: StreamChunk) => void;
  onDone?: (chunk: StreamChunk) => void;
  onError?: (chunk: StreamChunk | { message: string }) => void;
}

/** Wires the graph-mode (Phase 7) SSE event listeners shared by `streamChatMessage()` and `resumeGraphRun()` onto an already-open `EventSource`. */
function attachGraphListeners(source: EventSource, handlers: StreamChatHandlers): void {
  const parse = (event: MessageEvent<string>): StreamChunk => JSON.parse(event.data) as StreamChunk;

  source.addEventListener('graph_node_start', (event) => {
    handlers.onGraphNodeStart?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('graph_node_end', (event) => {
    handlers.onGraphNodeEnd?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('graph_interrupt', (event) => {
    handlers.onGraphInterrupt?.(parse(event as MessageEvent<string>));
    source.close();
  });
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
  promptSettings?: PromptSettings,
  toolSettings?: ToolSettings,
): () => void {
  const params = new URLSearchParams({ message, retrievalStrategy: settings.strategy });
  if (sessionId) params.set('sessionId', sessionId);

  const filters = buildFilters(settings);
  if (filters) params.set('filters', JSON.stringify(filters));

  params.set('useMmr', String(settings.useMmr));
  params.set('useRerank', String(settings.useRerank));
  params.set('useCompression', String(settings.useCompression));
  params.set('useQueryExpansion', String(settings.useQueryExpansion));

  if (promptSettings) {
    if (promptSettings.templateId) params.set('promptTemplateId', promptSettings.templateId);
    if (promptSettings.version !== undefined) {
      params.set('promptVersion', String(promptSettings.version));
    }
    params.set('useFewShot', String(promptSettings.useFewShot));
    params.set('structuredOutput', String(promptSettings.structuredOutput));
  }

  if (toolSettings) {
    params.set('useTools', String(toolSettings.useTools));
    if (toolSettings.enabledTools.length > 0) {
      params.set('enabledTools', toolSettings.enabledTools.join(','));
    }
    params.set('useAgent', String(toolSettings.useAgent));
    params.set('useGraph', String(toolSettings.useGraph));
  }

  const source = new EventSource(`${API_BASE_URL}/api/v1/chat/stream?${params.toString()}`);

  const parse = (event: MessageEvent<string>): StreamChunk => JSON.parse(event.data) as StreamChunk;

  source.addEventListener('citations', (event) => {
    handlers.onCitations?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('token', (event) => {
    handlers.onToken?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('tool_call', (event) => {
    handlers.onToolCall?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('tool_result', (event) => {
    handlers.onToolResult?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('agent_plan', (event) => {
    handlers.onAgentPlan?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('agent_thought', (event) => {
    handlers.onAgentThought?.(parse(event as MessageEvent<string>));
  });

  source.addEventListener('agent_observation', (event) => {
    handlers.onAgentObservation?.(parse(event as MessageEvent<string>));
  });

  attachGraphListeners(source, handlers);

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

/**
 * Resumes a turn paused by Phase 7's `human_approval` node — opens a fresh
 * SSE connection to `GET /chat/graph/resume/stream`, reusing the same
 * event set `streamChatMessage()` listens for (`token`/`done`/
 * `graph_node_start`/`graph_node_end`/`error`; another `graph_interrupt`
 * is possible if the resumed run hits a second sensitive tool call).
 */
export function resumeGraphRun(
  sessionId: string,
  approved: boolean,
  feedback: string | undefined,
  handlers: StreamChatHandlers,
): () => void {
  const params = new URLSearchParams({ sessionId, approved: String(approved) });
  if (feedback) params.set('feedback', feedback);

  const source = new EventSource(
    `${API_BASE_URL}/api/v1/chat/graph/resume/stream?${params.toString()}`,
  );

  const parse = (event: MessageEvent<string>): StreamChunk => JSON.parse(event.data) as StreamChunk;

  source.addEventListener('token', (event) => {
    handlers.onToken?.(parse(event as MessageEvent<string>));
  });

  attachGraphListeners(source, handlers);

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

/** The static topology `GET /api/v1/graph` returns — every node/edge the compiled graph can ever have, independent of any particular turn. Fetched once by `GraphVisualization` and reused across turns. */
export interface GraphDefinition {
  nodes: readonly { id: string; name: string }[];
  edges: readonly { source: string; target: string; conditional: boolean }[];
}

export async function getGraphDefinition(): Promise<GraphDefinition> {
  const res = await fetch(`${API_BASE_URL}/api/v1/graph`);
  if (!res.ok) {
    throw new Error(`Failed to load graph definition (status ${res.status})`);
  }
  return res.json() as Promise<GraphDefinition>;
}

/** One checkpoint in a thread's history, as `GET /api/v1/graph/state/:sessionId` returns it. */
export interface GraphCheckpointSummary {
  checkpointId?: string;
  next: readonly string[];
  createdAt?: string;
  stepCount: number;
  messageCount: number;
  hasPendingApproval: boolean;
}

export async function getGraphStateHistory(
  sessionId: string,
): Promise<readonly GraphCheckpointSummary[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/graph/state/${encodeURIComponent(sessionId)}`);
  if (!res.ok) {
    throw new Error(`Failed to load graph state history (status ${res.status})`);
  }
  const data = (await res.json()) as { checkpoints: GraphCheckpointSummary[] };
  return data.checkpoints;
}

/** Re-exported so `graph-visualization.tsx`/`graph-execution-replay.tsx` don't need a second import path just for the shared node-status shape. */
export type { GraphNodeInfo };
