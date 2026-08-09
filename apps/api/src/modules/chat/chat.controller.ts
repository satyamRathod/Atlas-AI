import type { Request, RequestHandler, Response } from 'express';
import { closeSSE, initializeSSE, sendSSE } from '../../http/sse.js';
import { logger } from '../../infrastructure/logger/logger.js';
import { chatRequestSchema, chatStreamQuerySchema } from './chat.schema.js';
import { type ChatService, toRetrievalOptions } from './chat.service.js';

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  public handle: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const request = chatRequestSchema.parse(req.body);

    const response = await this.chatService.invoke(request);
    res.status(200).json(response);
  };

  async stream(req: Request, res: Response): Promise<void> {
    initializeSSE(res);

    try {
      const abortController = new AbortController();
      req.on('aborted', () => {
        logger.info(
          {
            requestId: req.id,
          },
          'Client disconnected',
        );
        abortController.abort();
      });

      res.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      });

      const query = chatStreamQuerySchema.parse(req.query);

      const stream = this.chatService.stream({
        message: query.message,
        ...(query.sessionId ? { sessionId: query.sessionId } : {}),
        retrievalOptions: toRetrievalOptions(query),
        options: {
          signal: abortController.signal,
        },
      });

      for await (const chunk of stream) {
        // await new Promise((resolve) => setTimeout(resolve, 1000));
        sendSSE(res, chunk.type, chunk);
      }

      closeSSE(res);
    } catch (error) {
      if (!res.writableEnded) {
        sendSSE(res, 'error', {
          message: 'Streaming failed.',
        });
        closeSSE(res);
      }

      throw error;
    }
  }
}
