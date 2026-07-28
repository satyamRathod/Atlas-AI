import type { Command } from './command.js';
import { IngestCommand } from './commands/ingest.js';
import { SearchCommand } from './commands/search.js';

export const commands: Command[] = [new IngestCommand(), new SearchCommand()];
