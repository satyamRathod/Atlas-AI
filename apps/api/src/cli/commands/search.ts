import { env } from '@/config/env.js';
import { buildCli } from '../cli.factory.js';
import type { Command } from '../command.js';

export class SearchCommand implements Command {
  readonly name = 'search';

  readonly description = 'Semantic search';

  public async execute(): Promise<void> {
    const query = process.argv.slice(3).join(' ');

    if (!query) {
      throw new Error('Please provide a search query.');
    }

    const cli = buildCli();

    const results = await cli.retriever.retrieve(query);

    for (const result of results) {
      console.log(`Score : ${result.score.toFixed(4)}`);
      console.log(`Source: ${result.payload.source}`);
      console.log(`Chunk : ${result.payload.index}`);
      console.log(result.payload.content);
      console.log('-------------------------------------------------\n');
    }
  }
}
