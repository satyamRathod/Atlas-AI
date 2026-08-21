import { randomUUID } from 'node:crypto';

import type { StructuredToolInterface } from '@langchain/core/tools';

import type { RegisteredTool, ToolCallInfo } from './tool.types.js';

export interface ToolCallRequest {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Tool execution timed out after ${ms}ms.`)),
      ms,
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Runs a resolved tool call with a shared timeout + error-handling wrapper
 * (§3 of docs/phases/phase-5-tools.md) — the "Tool execution" and
 * "Error handling" roadmap items. `execute()` always resolves (never
 * throws): a bad argument, a thrown error inside a tool, or a timeout all
 * become `{ status: 'error', error }` instead of ever failing the whole
 * chat turn, so `ChatService`'s tool loop can feed the failure back to the
 * model as a normal `ToolMessage` and let it explain/recover.
 */
export class ToolExecutor {
  private readonly tools: Map<string, RegisteredTool>;

  constructor(
    registry: readonly RegisteredTool[],
    private readonly timeoutMs: number,
  ) {
    this.tools = new Map(registry.map((entry) => [entry.name, entry]));
  }

  public listDefinitions(): { name: string; description: string }[] {
    return [...this.tools.values()].map(({ name, description }) => ({ name, description }));
  }

  /** `names` filters to a subset (unknown names are ignored); omitted/empty means "all registered tools". */
  public getBindableTools(names?: readonly string[]): StructuredToolInterface[] {
    return this.filterTools(names).map((entry) => entry.structuredTool);
  }

  /**
   * The raw registered entries (including `schema`), filtered the same way
   * as `getBindableTools()`. Used by Phase 6's `react-prompt.ts` to render
   * each tool's name/description/args shape as plain text for the ReAct
   * system prompt, instead of the native `bindTools` schema `getBindableTools()`
   * produces.
   */
  public getRegisteredTools(names?: readonly string[]): RegisteredTool[] {
    return this.filterTools(names);
  }

  private filterTools(names?: readonly string[]): RegisteredTool[] {
    const all = [...this.tools.values()];
    return names && names.length > 0 ? all.filter((entry) => names.includes(entry.name)) : all;
  }

  public async execute(call: ToolCallRequest): Promise<ToolCallInfo> {
    const id = call.id ?? randomUUID();
    const start = performance.now();
    const registered = this.tools.get(call.name);

    if (!registered) {
      return {
        id,
        name: call.name,
        args: call.args,
        status: 'error',
        error: `Unknown tool "${call.name}".`,
        durationMs: 0,
      };
    }

    const parsed = registered.schema.safeParse(call.args);
    if (!parsed.success) {
      return {
        id,
        name: call.name,
        args: call.args,
        status: 'error',
        error: `Invalid arguments: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
        durationMs: Math.round(performance.now() - start),
      };
    }

    try {
      const output = await withTimeout(registered.execute(parsed.data), this.timeoutMs);

      return {
        id,
        name: call.name,
        args: call.args,
        status: 'success',
        output,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (error) {
      return {
        id,
        name: call.name,
        args: call.args,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Math.round(performance.now() - start),
      };
    }
  }
}
