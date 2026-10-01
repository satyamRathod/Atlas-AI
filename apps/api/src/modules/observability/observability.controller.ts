import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import type { RedisObservabilityStore } from './infrastructure/redis-observability-store.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sessionId: z.string().trim().min(1).optional(),
});

const metricsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const turnIdParamSchema = z.object({
  turnId: z.string().trim().min(1, 'turnId is required'),
});

/**
 * Read API for Phase 10 observability — recent turns, full turn detail,
 * and aggregate metrics (§4 of docs/phases/phase-10-observability.md).
 */
export class ObservabilityController {
  constructor(private readonly store: RedisObservabilityStore) {}

  public listTurns: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const query = listQuerySchema.parse(req.query);
    const turns = await this.store.listRecentTurns({
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
      ...(query.sessionId !== undefined ? { sessionId: query.sessionId } : {}),
    });
    res.status(200).json({ turns });
  };

  public getTurn: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { turnId } = turnIdParamSchema.parse(req.params);
    const turn = await this.store.getTurn(turnId);
    if (!turn) {
      res.status(404).json({ message: `Observability turn "${turnId}" not found.` });
      return;
    }
    res.status(200).json(turn);
  };

  public metrics: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const query = metricsQuerySchema.parse(req.query);
    const metrics = await this.store.aggregate({
      ...(query.limit !== undefined ? { limit: query.limit } : {}),
    });
    res.status(200).json(metrics);
  };
}
