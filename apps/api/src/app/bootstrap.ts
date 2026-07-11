import { env } from '../config/index.js';
import { logger } from '../infrastructure/logger/index.js';

import { buildApplication } from './application.factory.js';

export async function bootstrap(): Promise<void> {
  const { server } = buildApplication();

  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        environment: env.NODE_ENV,
      },
      `${env.APP_NAME} started successfully`,
    );
  });
}
