import type { Server } from 'node:http';

import type { Express } from 'express';

export interface Application {
  app: Express;
  server: Server;
}
