import { useCallback, useEffect, useRef, useState } from 'react';

import { resumeGraphRun, type StreamChatHandlers, streamChatMessage } from '@/lib/api';
import type {
  AgentStepDisplay,
  ChatMessage,
  EvaluationSettings,
  GraphNodeDisplay,
  MultiAgentTurnDisplay,
  PromptSettings,
  RetrievalSettings,
  ToolCallDisplay,
  ToolSettings,
} from '@/types/chat';

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

/**
 * Appends a `graphNodes` row for `graph_node_start`, or fills in the
 * matching row's final status for `graph_node_end` — falling back to a
 * fresh row when there's no in-flight `running` row to fill in (the
 * `human_approval` "interrupted" event fires as a *second* `graph_node_end`
 * for the same node, with no `graph_node_start` of its own — see §3 of
 * docs/phases/phase-7-langgraph.md).
 */
function reduceGraphNodes(
  nodes: readonly GraphNodeDisplay[],
  update: { nodeId: string; status: GraphNodeDisplay['status']; durationMs?: number },
  isStart: boolean,
): GraphNodeDisplay[] {
  if (isStart) {
    return [...nodes, { nodeId: update.nodeId, status: update.status, step: nodes.length }];
  }

  const lastIndex = nodes.length - 1;
  const last = nodes[lastIndex];
  if (last && last.status === 'running' && last.nodeId === update.nodeId) {
    return nodes.map((node, index) => (index === lastIndex ? { ...node, ...update } : node));
  }

  return [...nodes, { ...update, step: nodes.length }];
}

/**
 * Appends an `agentTurns` row for `agent_turn_start`, or fills in the
 * matching row's final status for `agent_turn_end` — mirrors
 * `reduceGraphNodes` above, keyed by `role` instead of `nodeId`. Unlike
 * graph nodes, there's no "second end with no matching start" edge case
 * here (a multi-agent turn never pauses), so the fallback branch is only
 * ever hit if a client missed a `_start` event on a flaky connection.
 */
function reduceAgentTurns(
  turns: readonly MultiAgentTurnDisplay[],
  update: {
    role: MultiAgentTurnDisplay['role'];
    round: number;
    status: MultiAgentTurnDisplay['status'];
    durationMs?: number;
  },
  isStart: boolean,
): MultiAgentTurnDisplay[] {
  if (isStart) {
    return [...turns, { ...update, step: turns.length }];
  }

  const lastIndex = turns.length - 1;
  const last = turns[lastIndex];
  if (
    last &&
    last.status === 'running' &&
    last.role === update.role &&
    last.round === update.round
  ) {
    return turns.map((turn, index) => (index === lastIndex ? { ...turn, ...update } : turn));
  }

  return [...turns, { ...update, step: turns.length }];
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

  /**
   * The event handlers shared by a fresh `sendMessage()` turn and an
   * `approveGraphRun()` resume — both stream onto the *same* assistant
   * message id, and Phase 7's `graph_node_start`/`graph_node_end`/
   * `graph_interrupt` events are handled identically either way (a resume
   * just picks up wherever the graph paused, appending to the same
   * `graphNodes` timeline instead of starting a new one).
   */
  const createStreamHandlers = useCallback(
    (assistantId: string, startedAt: number): StreamChatHandlers => {
      let firstTokenAt: number | undefined;

      return {
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
        onToolCall: (chunk) => {
          if (!chunk.toolCall) return;
          const { id, name, args } = chunk.toolCall;
          updateAssistantMessage(assistantId, (msg) => ({
            toolCalls: [...(msg.toolCalls ?? []), { id, name, args, status: 'running' }],
          }));
        },
        onToolResult: (chunk) => {
          if (!chunk.toolResult) return;
          const result = chunk.toolResult;
          updateAssistantMessage(assistantId, (msg) => ({
            toolCalls: (msg.toolCalls ?? []).map(
              (call): ToolCallDisplay => (call.id === result.id ? { ...call, ...result } : call),
            ),
          }));
        },
        onAgentPlan: (chunk) => {
          if (!chunk.agentPlan) return;
          updateAssistantMessage(assistantId, { agentPlan: chunk.agentPlan });
        },
        onAgentThought: (chunk) => {
          if (!chunk.agentStep) return;
          const { index, thought, action, actionInput } = chunk.agentStep;
          const row: AgentStepDisplay = {
            index,
            thought,
            status: action ? 'acting' : 'final',
            ...(action ? { action } : {}),
            ...(actionInput ? { actionInput } : {}),
          };
          updateAssistantMessage(assistantId, (msg) => ({
            agentSteps: [...(msg.agentSteps ?? []), row],
          }));
        },
        onAgentObservation: (chunk) => {
          if (!chunk.agentObservation) return;
          const observation = chunk.agentObservation;
          updateAssistantMessage(assistantId, (msg) => ({
            agentSteps: (msg.agentSteps ?? []).map(
              (step): AgentStepDisplay =>
                step.index === observation.index ? { ...step, ...observation } : step,
            ),
          }));
        },
        onGraphNodeStart: (chunk) => {
          if (!chunk.graphNode) return;
          const { nodeId, status } = chunk.graphNode;
          updateAssistantMessage(assistantId, (msg) => ({
            graphNodes: reduceGraphNodes(msg.graphNodes ?? [], { nodeId, status }, true),
          }));
        },
        onGraphNodeEnd: (chunk) => {
          if (!chunk.graphNode) return;
          const { nodeId, status, durationMs } = chunk.graphNode;
          updateAssistantMessage(assistantId, (msg) => ({
            graphNodes: reduceGraphNodes(
              msg.graphNodes ?? [],
              { nodeId, status, ...(durationMs !== undefined ? { durationMs } : {}) },
              false,
            ),
          }));
        },
        onGraphInterrupt: (chunk) => {
          if (!chunk.graphInterrupt) return;
          updateAssistantMessage(assistantId, {
            isStreaming: false,
            pendingApproval: chunk.graphInterrupt,
          });
          setIsStreaming(false);
        },
        onAgentTurnStart: (chunk) => {
          if (!chunk.agentTurn) return;
          const { role, round, status } = chunk.agentTurn;
          updateAssistantMessage(assistantId, (msg) => ({
            agentTurns: reduceAgentTurns(msg.agentTurns ?? [], { role, round, status }, true),
          }));
        },
        onAgentTurnEnd: (chunk) => {
          if (!chunk.agentTurn) return;
          const { role, round, status, durationMs } = chunk.agentTurn;
          updateAssistantMessage(assistantId, (msg) => ({
            agentTurns: reduceAgentTurns(
              msg.agentTurns ?? [],
              { role, round, status, ...(durationMs !== undefined ? { durationMs } : {}) },
              false,
            ),
          }));
        },
        onDone: (chunk) => {
          updateAssistantMessage(assistantId, (msg) => ({
            isStreaming: false,
            usage: chunk.usage,
            model: chunk.model,
            memory: chunk.memory,
            promptInfo: chunk.promptInfo,
            guardrails: chunk.guardrails,
            structuredOutput: chunk.structuredOutput,
            pendingApproval: undefined,
            ...(chunk.toolCalls !== undefined ? { toolCalls: chunk.toolCalls } : {}),
            ...(chunk.agentRun !== undefined
              ? { agentPlan: chunk.agentRun.plan, agentSteps: chunk.agentRun.steps }
              : {}),
            // `chunk.graphRun.nodes` only covers the *current* `driveGraph()`
            // call — after a resume, that's just the post-approval nodes, not
            // the pre-interrupt ones already live-streamed onto `msg.graphNodes`
            // via `onGraphNodeStart`/`onGraphNodeEnd`. That live-accumulated
            // list is already the complete, correctly-ordered timeline, so it
            // only needs a `graphRun` fallback when nothing was streamed at all
            // (e.g. a client that missed the live events on reconnect).
            ...(chunk.graphRun !== undefined && (!msg.graphNodes || msg.graphNodes.length === 0)
              ? { graphNodes: chunk.graphRun.nodes.map((node, step) => ({ ...node, step })) }
              : {}),
            // No resume/interrupt split for a multi-agent turn (§3 of
            // docs/phases/phase-8-multi-agent.md) — `done` always follows the
            // live `agent_turn_start`/`agent_turn_end` events for the same
            // run, so setting `multiAgentRun` straight from `chunk` here is
            // safe (unlike `graphRun.nodes` above, there's no earlier partial
            // run's data it could ever clobber).
            ...(chunk.multiAgentRun !== undefined ? { multiAgentRun: chunk.multiAgentRun } : {}),
            ...(chunk.evaluation !== undefined ? { evaluation: chunk.evaluation } : {}),
            latencyMs: performance.now() - startedAt,
          }));
          setIsStreaming(false);
        },
        onError: (chunk) => {
          updateAssistantMessage(assistantId, {
            isStreaming: false,
            error: 'message' in chunk ? chunk.message : 'Something went wrong.',
          });
          setIsStreaming(false);
        },
      };
    },
    [updateAssistantMessage],
  );

  const sendMessage = useCallback(
    (
      content: string,
      retrievalSettings: RetrievalSettings,
      promptSettings?: PromptSettings,
      toolSettings?: ToolSettings,
      evaluationSettings?: EvaluationSettings,
    ) => {
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
      const close = streamChatMessage(
        trimmed,
        sessionId,
        retrievalSettings,
        createStreamHandlers(assistantId, startedAt),
        promptSettings,
        toolSettings,
        evaluationSettings,
      );

      closeStreamRef.current = close;
    },
    [isStreaming, sessionId, createStreamHandlers],
  );

  /**
   * Resumes a turn paused by Phase 7's `human_approval` node (§4 of
   * docs/phases/phase-7-langgraph.md) — `messageId` is the assistant
   * message that currently has `pendingApproval` set. Reuses
   * `createStreamHandlers()` so the resumed run's `graph_node_start`/
   * `graph_node_end`/`token`/`done` events reconcile onto that same
   * message exactly like the initial (paused) run did.
   */
  const approveGraphRun = useCallback(
    (messageId: string, approved: boolean, feedback?: string) => {
      if (!sessionId || isStreaming) return;

      closeStreamRef.current?.();
      updateAssistantMessage(messageId, { isStreaming: true, pendingApproval: undefined });
      setIsStreaming(true);

      const startedAt = performance.now();
      const close = resumeGraphRun(
        sessionId,
        approved,
        feedback,
        createStreamHandlers(messageId, startedAt),
      );

      closeStreamRef.current = close;
    },
    [sessionId, isStreaming, updateAssistantMessage, createStreamHandlers],
  );

  const resetConversation = useCallback(() => {
    closeStreamRef.current?.();
    setMessages([]);
    setSessionId(undefined);
    setIsStreaming(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    sessionId,
    isStreaming,
    sendMessage,
    approveGraphRun,
    resetConversation,
  };
}
