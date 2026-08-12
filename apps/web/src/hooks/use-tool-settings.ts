import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_TOOL_SETTINGS } from '@/lib/tool-options';
import type { ToolSettings } from '@/types/chat';

const STORAGE_KEY = 'atlas.tool-settings.v1';

function loadPersistedSettings(): ToolSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TOOL_SETTINGS;
    return { ...DEFAULT_TOOL_SETTINGS, ...(JSON.parse(raw) as Partial<ToolSettings>) };
  } catch {
    return DEFAULT_TOOL_SETTINGS;
  }
}

/**
 * Backs the tools settings bar: persists the `useTools` toggle and
 * `enabledTools` selection across reloads, the same way `usePromptSettings`
 * persists Phase 4's template/few-shot/structured-output state.
 */
export function useToolSettings() {
  const [settings, setSettings] = useState<ToolSettings>(loadPersistedSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<ToolSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_TOOL_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
