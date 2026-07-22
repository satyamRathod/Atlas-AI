import { commands } from './registry.js';

const [, , commandName, ...args] = process.argv;

const command = commands.find((c) => c.name === commandName);

if (!command) {
  console.log('Available commands:\n');

  for (const c of commands) {
    console.log(`${c.name.padEnd(12)} ${c.description}`);
  }

  process.exit(1);
}

await command.execute(args);
