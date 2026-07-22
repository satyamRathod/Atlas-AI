import { ingestCommand } from './commands/ingest.js';

const command = process.argv[2];

switch (command) {
  case 'ingest':
    await ingestCommand();
    break;

  default:
    console.log(`
Available commands

pnpm ai ingest
`);
}
