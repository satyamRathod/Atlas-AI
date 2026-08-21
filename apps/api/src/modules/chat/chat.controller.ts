import type { Request, RequestHandler, Response } from 'express';
import { closeSSE, initializeSSE, sendSSE } from '../../http/sse.js';
import { logger } from '../../infrastructure/logger/logger.js';
import {
  chatGraphResumeSchema,
  chatGraphResumeStreamQuerySchema,
  chatRequestSchema,
  chatStreamQuerySchema,
} from './chat.schema.js';
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
        ...(query.promptTemplateId ? { promptTemplateId: query.promptTemplateId } : {}),
        ...(query.promptVersion !== undefined ? { promptVersion: query.promptVersion } : {}),
        ...(query.useFewShot !== undefined ? { useFewShot: query.useFewShot } : {}),
        ...(query.structuredOutput !== undefined
          ? { structuredOutput: query.structuredOutput }
          : {}),
        ...(query.useTools !== undefined ? { useTools: query.useTools } : {}),
        ...(query.enabledTools !== undefined ? { enabledTools: query.enabledTools } : {}),
        ...(query.useAgent !== undefined ? { useAgent: query.useAgent } : {}),
        ...(query.useGraph !== undefined ? { useGraph: query.useGraph } : {}),
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

  /**
   * Resumes a turn paused by the LangGraph `human_approval` node — the
   * non-streaming equivalent of `streamResumeGraph()` below (§4 of
   * docs/phases/phase-7-langgraph.md).
   */
  public resumeGraph: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const { sessionId, approved, feedback } = chatGraphResumeSchema.parse(req.body);

    const response = await this.chatService.invokeResume(sessionId, {
      approved,
      ...(feedback !== undefined ? { feedback } : {}),
    });
    res.status(200).json(response);
  };

  async streamResumeGraph(req: Request, res: Response): Promise<void> {
    initializeSSE(res);

    try {
      const abortController = new AbortController();
      req.on('aborted', () => abortController.abort());
      res.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      });

      const query = chatGraphResumeStreamQuerySchema.parse(req.query);

      const stream = this.chatService.streamResume(query.sessionId, {
        approved: query.approved,
        ...(query.feedback !== undefined ? { feedback: query.feedback } : {}),
      });

      for await (const chunk of stream) {
        sendSSE(res, chunk.type, chunk);
      }

      closeSSE(res);
    } catch (error) {
      if (!res.writableEnded) {
        sendSSE(res, 'error', {
          message: 'Resuming the graph run failed.',
        });
        closeSSE(res);
      }

      throw error;
    }
  }
}
