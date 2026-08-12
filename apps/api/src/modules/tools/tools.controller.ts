import type { Request, RequestHandler, Response } from 'express';

import type { ToolExecutor } from '@/langchain/tools/index.js';

/**
 * Minimal listing endpoint — `GET /api/v1/tools` — so the frontend's
 * settings bar can render real tool names/descriptions instead of
 * hardcoding them (§3 of docs/phases/phase-5-tools.md). No CRUD: unlike
 * `modules/prompts/`, tools are only ever defined in code
 * (`langchain/tools/`), not authored at runtime.
 */
export class ToolsController {
  constructor(private readonly toolExecutor: ToolExecutor) {}

  public list: RequestHandler = (_req: Request, res: Response): void => {
    res.status(200).json({ tools: this.toolExecutor.listDefinitions() });
  };
}
