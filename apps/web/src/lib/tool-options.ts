import type { ToolSettings } from '@/types/chat';

/** Mirrors the backend's default (`useTools`/`useAgent: false` — both opt-in, not on by default). */
export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  useTools: false,
  enabledTools: [],
  useAgent: false,
};
