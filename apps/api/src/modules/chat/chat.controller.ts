import type { Request, RequestHandler, Response } from 'express';

import { chatRequestSchema } from './chat.schema.js';
import type { ChatService } from './chat.service.js';

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  public handle: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const request = chatRequestSchema.parse(req.body);

    const response = await this.chatService.execute(request);
    res.status(200).json(response);
  };
}
