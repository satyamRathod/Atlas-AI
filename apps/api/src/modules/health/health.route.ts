import { type Response, Router } from 'express';

import { env } from '../../config/index.js';

const router: Router = Router();

router.get('/', (_, res: Response) => {
  res.status(200).json({
    status: 'UP',
    service: 'atlas-api',
    version: '0.0.1',
    environment: env.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
