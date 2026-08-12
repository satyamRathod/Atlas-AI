import type { StructuredToolInterface } from '@langchain/core/tools';
import type { z } from 'zod';

/**
 * One tool-call's outcome for a single turn — what `ToolExecutor.execute()`
 * always resolves to (never throws), and what the chat API surfaces on
 * `ChatResponse.toolCalls` / the `tool_result` SSE event (§4 of
 * docs/phases/phase-5-tools.md).
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'success' | 'error';
  output?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * The instant the model decides to call a tool, before execution — no
 * `status`/`output`/`durationMs` yet, since the call hasn't run. Powers the
 * `tool_call` SSE event, which turns the tool timeline into a genuine live
 * waterfall instead of a static post-hoc list (§4).
 */
export interface ToolCallStart {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * A registered tool: `structuredTool` is what gets passed to
 * `chatModel.bindTools()` so the model can decide to call it; `schema` +
 * `execute` are what `ToolExecutor` actually runs once the model asks —
 * kept separate from `structuredTool.invoke()` so `ToolExecutor` can
 * validate args and apply a shared timeout/error-handling wrapper itself
 * (§3), instead of relying on each tool's own error conventions.
 */
export interface RegisteredTool<Args = Record<string, unknown>> {
  name: string;
  description: string;
  schema: z.ZodType<Args>;
  execute: (args: Args) => Promise<unknown>;
  structuredTool: StructuredToolInterface;
}
