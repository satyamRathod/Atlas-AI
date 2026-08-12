import type { Request, RequestHandler, Response } from 'express';

import {
  addPromptVersionSchema,
  createPromptTemplateSchema,
  getPromptTemplateQuerySchema,
} from './prompt.schema.js';
import { PromptNotFoundError, type PromptService } from './prompt.service.js';

export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  public list: RequestHandler = async (_req: Request, res: Response): Promise<void> => {
    const templates = await this.promptService.listTemplates();
    res.status(200).json({ templates });
  };

  public get: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const query = getPromptTemplateQuerySchema.parse(req.query);

    try {
      const template = await this.promptService.getTemplate(req.params.id as string);

      if (query.version !== undefined) {
        const version = template.versions.find((v) => v.version === query.version);
        if (!version) {
          res.status(404).json({ message: `Version ${query.version} was not found.` });
          return;
        }
        res.status(200).json({ ...template, versions: [version] });
        return;
      }

      res.status(200).json(template);
    } catch (error) {
      if (error instanceof PromptNotFoundError) {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  };

  public create: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const input = createPromptTemplateSchema.parse(req.body);

    try {
      const template = await this.promptService.createTemplate(input);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ message: error.message });
        return;
      }
      throw error;
    }
  };

  public addVersion: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const input = addPromptVersionSchema.parse(req.body);

    try {
      const version = await this.promptService.addVersion(req.params.id as string, input);
      res.status(201).json(version);
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not exist')) {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  };
}
