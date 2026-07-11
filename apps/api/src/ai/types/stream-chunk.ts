import type { Usage } from './usage.js';

export type StreamChunk =
  | {
      type: 'start';
    }
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
    }
  | {
      type: 'error';
      message: string;
    };
