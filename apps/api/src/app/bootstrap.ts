import { env } from '../config/index.js';
import server from '../http/server.js';
import { logger } from '../infrastructure/logger/logger.js';

export async function bootstrap() {
  server.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        environment: env.NODE_ENV,
      },
      'Atlas API started',
    );
  });
}
