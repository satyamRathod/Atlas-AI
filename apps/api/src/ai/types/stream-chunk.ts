import type { Usage } from './usage.js';

export type StreamChunk =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'usage';
      usage: Usage;
    }
  | {
      type: 'done';
    };
