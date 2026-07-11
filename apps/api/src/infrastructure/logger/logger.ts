import pino from 'pino';

import { env } from '../../config/index.js';

export const logger = pino({
  level: env.LOG_LEVEL,

  timestamp: pino.stdTimeFunctions.isoTime,

  base: {
    service: env.APP_NAME,
    environment: env.NODE_ENV,
  },

  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
          },
        },
      }
    : {}),
});
