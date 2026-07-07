import { bootstrap } from './app/bootstrap.js';

try {
  await bootstrap();
} catch (error) {
  console.error(error);
  process.exit(1);
}
