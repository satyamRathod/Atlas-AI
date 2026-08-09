import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_RETRIEVAL_SETTINGS } from '@/lib/retrieval-options';
import type { RetrievalSettings } from '@/types/chat';

const STORAGE_KEY = 'atlas.retrieval-settings.v1';

function loadPersistedSettings(): RetrievalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RETRIEVAL_SETTINGS;
    return { ...DEFAULT_RETRIEVAL_SETTINGS, ...(JSON.parse(raw) as Partial<RetrievalSettings>) };
  } catch {
    return DEFAULT_RETRIEVAL_SETTINGS;
  }
}

/**
 * Backs the retrieval strategy switcher: persists the chosen strategy,
 * metadata filters, and MMR/rerank/compression/query-expansion toggles
 * across reloads, the same way `useChat` persists message history.
 */
export function useRetrievalSettings() {
  const [settings, setSettings] = useState<RetrievalSettings>(loadPersistedSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<RetrievalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_RETRIEVAL_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
