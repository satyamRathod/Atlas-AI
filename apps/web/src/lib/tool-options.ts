import type { ToolSettings } from '@/types/chat';

/** Mirrors the backend's default (`useTools`/`useAgent`/`useGraph: false` — all opt-in, none on by default). */
export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  useTools: false,
  enabledTools: [],
  useAgent: false,
  useGraph: false,
};
