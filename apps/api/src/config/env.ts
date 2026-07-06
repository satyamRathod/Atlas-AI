import { config as loadEnv } from "dotenv";
import { z } from "zod";

//load environment variables from .env file into process.env
loadEnv();

//define environment variables schema
const envSchema = z.object({
  PORT: z.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

//validate environment variables
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables");
  console.error(parsed.error.format());

  process.exit(1);
}

export const env = Object.freeze(parsed.data);