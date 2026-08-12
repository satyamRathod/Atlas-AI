import type { RetrievalPipeline } from '@/langchain/retrieval/index.js';

import { createCalculatorTool } from './calculator-tool.js';
import { createDatabaseTool } from './database-tool.js';
import { createDatetimeTool } from './datetime-tool.js';
import { createFileSearchTool } from './file-search-tool.js';
import type { RegisteredTool } from './tool.types.js';
import { createWeatherTool } from './weather-tool.js';

export interface ToolRegistryDeps {
  retrievalPipeline: RetrievalPipeline;
}

/**
 * Builds every tool the chat backend can bind to a turn (§2 of
 * docs/phases/phase-5-tools.md) — calculator, weather, file_search (needs
 * the same `RetrievalPipeline` Phase 1/2 already built), order_lookup, and
 * get_current_datetime (the "custom tool" example). Called once at boot
 * (`application.factory.ts`); the resulting list is wrapped by
 * `ToolExecutor` and shared by `ChatService` and the `/api/v1/tools`
 * listing endpoint.
 */
export function createToolRegistry({ retrievalPipeline }: ToolRegistryDeps): RegisteredTool[] {
  return [
    createCalculatorTool(),
    createWeatherTool(),
    createFileSearchTool(retrievalPipeline),
    createDatabaseTool(),
    createDatetimeTool(),
  ];
}
