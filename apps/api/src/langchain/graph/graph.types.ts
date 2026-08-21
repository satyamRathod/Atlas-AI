import type { ToolCallInfo } from '@/langchain/tools/index.js';

/**
 * One proposed tool call, surfaced to a human for a yes/no decision before
 * it runs (§4 of docs/phases/phase-7-langgraph.md). Carried as the `value`
 * passed to LangGraph's `interrupt()` inside the `human_approval` node, and
 * mirrored on `ChatResponse.graphRun.pendingApproval` / the `graph_interrupt`
 * SSE event so a client has everything it needs to render an approval UI
 * without a second round-trip.
 */
export interface PendingApprovalInfo {
  toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
  reason: string;
}

/** What a client sends back to resume a paused run — the value LangGraph's `interrupt()` call resolves to inside the `human_approval` node. */
export interface GraphResumeDecision {
  approved: boolean;
  feedback?: string;
}

/**
 * One node's execution, as reported by the `tasks` stream mode (§3). Two
 * of these are yielded per node per pass through the graph — one on start,
 * one on completion/interruption — so a live graph-visualization UI can
 * highlight whichever node is currently running.
 */
export interface GraphNodeInfo {
  nodeId: string;
  status: 'running' | 'success' | 'error' | 'interrupted';
  durationMs?: number;
  /** A short, best-effort human-readable summary of what the node did (e.g. which tool(s) it called) — never required for correctness. */
  summary?: string;
}

/** Yielded by `GraphAgentRunner.run()`/`.resume()` the instant a node starts or finishes, so the streaming path can forward live progress — mirrors Phase 5/6's `ToolLoopEvent`/`AgentLoopEvent`. */
export type GraphLoopEvent =
  | { type: 'graph_node_start'; node: GraphNodeInfo }
  | { type: 'graph_node_end'; node: GraphNodeInfo };

/** The full node-by-node timeline for one turn — what `ChatResponse.graphRun` / the `done` SSE event carries once a run finishes (or pauses). */
export interface GraphRunInfo {
  nodes: readonly GraphNodeInfo[];
  interrupted: boolean;
  /** Only present when `interrupted` is `true`. */
  pendingApproval?: PendingApprovalInfo;
  /** The checkpointer thread id this run is stored under — the chat `sessionId`, so a resume/state-inspector call always knows what to ask for. */
  threadId: string;
}

/** Re-exported here so `graph-agent-runner.ts` doesn't need to reach into `langchain/tools/` directly for this one type. */
export type { ToolCallInfo };
