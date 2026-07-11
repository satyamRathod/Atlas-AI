import type { Response } from 'express';

export function initializeSSE(res: Response): void {
  res.status(200);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders();
}

export function sendSSE(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function closeSSE(res: Response): void {
  res.end();
}
