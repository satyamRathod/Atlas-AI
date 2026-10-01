import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_EVALUATION_SETTINGS } from '@/lib/evaluation-options';
import type { EvaluationSettings } from '@/types/chat';

const STORAGE_KEY = 'atlas.evaluation-settings.v1';

function loadPersistedSettings(): EvaluationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EVALUATION_SETTINGS;
    return { ...DEFAULT_EVALUATION_SETTINGS, ...(JSON.parse(raw) as Partial<EvaluationSettings>) };
  } catch {
    return DEFAULT_EVALUATION_SETTINGS;
  }
}

/** Persists the Phase 9 `useEvaluation` toggle across reloads. */
export function useEvaluationSettings() {
  const [settings, setSettings] = useState<EvaluationSettings>(loadPersistedSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<EvaluationSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_EVALUATION_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
