import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const config = {
  env: _env.data.NODE_ENV,
  port: parseInt(_env.data.PORT, 10),
  db: {
    url: _env.data.DATABASE_URL,
  },
  jwt: {
    secret: _env.data.JWT_SECRET,
  },
  logLevel: _env.data.LOG_LEVEL,
};
