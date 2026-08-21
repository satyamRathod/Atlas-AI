import type { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

import type { ToolCallInfo } from '@/langchain/tools/index.js';

/**
 * The graph's shared state (§1 of docs/phases/phase-7-langgraph.md) — every
 * node reads from this and returns a partial update to it. `messages`
 * accumulates (the ReAct-style scratchpad-as-messages, native `bindTools`
 * style); everything else replaces on write, since it's set once per turn
 * and only ever read afterwards.
 *
 * `turnMeta` is deliberately untyped here (`Record<string, unknown>`) —
 * this module has no business knowing `ChatService`'s response shape. It's
 * just an opaque bag `ChatService` stashes at the start of a run and reads
 * back (via the checkpointer) after an interrupt/resume, since a resume
 * request has no other way to recover the citations/retrieval/memory info
 * computed for the *original* turn.
 */
export const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  question: Annotation<string>,
  contextText: Annotation<string>,
  summaryText: Annotation<string>,
  memoryText: Annotation<string>,
  enabledToolNames: Annotation<string[] | undefined>,
  stepCount: Annotation<number>,
  toolCallLog: Annotation<ToolCallInfo[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  turnMeta: Annotation<Record<string, unknown> | undefined>,
});

export type GraphStateType = typeof GraphState.State;
