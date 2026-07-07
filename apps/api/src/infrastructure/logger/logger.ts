import pino from 'pino';

import { env } from '../../config/index.js';

export const logger = pino({
  level: env.LOG_LEVEL,

  timestamp: pino.stdTimeFunctions.isoTime,

  base: {
    service: 'atlas-api',
  },

  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : {}),
});
