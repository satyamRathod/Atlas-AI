import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

//load environment variables from .env file into process.env
loadEnv();

//define environment variables schema
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().default('atlas-api'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-5'),
  OPENAI_BASE_URL: z.string().optional(),
});

//validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables');
  console.error(z.flattenError(parsedEnv.error));

  throw new Error('Invalid environment variables.');
}

export const env = Object.freeze(parsedEnv.data);
