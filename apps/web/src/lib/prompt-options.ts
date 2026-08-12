import type { PromptSettings } from '@/types/chat';

/** Mirrors the backend's env default (`PROMPT_DEFAULT_TEMPLATE_ID=default`). */
export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  templateId: 'default',
  useFewShot: false,
  structuredOutput: false,
};
