import { type Response, Router } from 'express';

import { env } from '../../config/index.js';

const router: Router = Router();

router.get('/', (_, res: Response): void => {
  res.status(200).json({
    status: 'UP',
    service: 'atlas-api',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

export default router;
