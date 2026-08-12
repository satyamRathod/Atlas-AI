import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_PROMPT_SETTINGS } from '@/lib/prompt-options';
import type { PromptSettings } from '@/types/chat';

const STORAGE_KEY = 'atlas.prompt-settings.v1';

function loadPersistedSettings(): PromptSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPT_SETTINGS;
    return { ...DEFAULT_PROMPT_SETTINGS, ...(JSON.parse(raw) as Partial<PromptSettings>) };
  } catch {
    return DEFAULT_PROMPT_SETTINGS;
  }
}

/**
 * Backs the prompt settings bar: persists the chosen template/version and
 * few-shot/structured-output toggles across reloads, the same way
 * `useRetrievalSettings` persists Phase 2's strategy switcher state.
 */
export function usePromptSettings() {
  const [settings, setSettings] = useState<PromptSettings>(loadPersistedSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<PromptSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_PROMPT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
