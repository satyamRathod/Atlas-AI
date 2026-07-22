import type { Command } from './command.js';
import { IngestCommand } from './commands/ingest.js';

export const commands: Command[] = [new IngestCommand()];
