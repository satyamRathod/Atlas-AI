import type { Command } from './command.js';
import { KnowledgeIndexCommand } from './commands/knowledge-index.command.js';
import { KnowledgeSearchCommand } from './commands/knowledge-search.command.js';

export const commands: Command[] = [new KnowledgeIndexCommand(), new KnowledgeSearchCommand()];
