import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';

export const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  genReqId: () => randomUUID(),
});
