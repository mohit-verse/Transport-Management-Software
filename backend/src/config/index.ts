import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    STORAGE_DIR: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
    DATABASE_SSL: z.enum(['true', 'false']).optional(),
    DATABASE_SSL_CA: z.string().optional(),
    BACKUP_DIR: z.string().optional(),
    BACKUP_RETENTION_COUNT: z.string().optional(),
    BACKUP_RETENTION_DAYS: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      if (!data.STORAGE_DIR || data.STORAGE_DIR.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['STORAGE_DIR'],
          message: 'STORAGE_DIR is required in production mode and must specify a persistent path',
        });
      }
      if (!data.CORS_ORIGIN || data.CORS_ORIGIN.trim() === '' || data.CORS_ORIGIN.trim() === '*') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message: 'CORS_ORIGIN is required in production mode and cannot be a wildcard (*)',
        });
      }
    }
  });

export const parseEnv = (rawEnv: NodeJS.ProcessEnv) => {
  return envSchema.safeParse(rawEnv);
};

const _env = parseEnv(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

// Compute default storage directory
const defaultStorageDir = path.resolve(__dirname, '../../../storage/development');
const resolvedStorageDir = _env.data.STORAGE_DIR
  ? path.resolve(_env.data.STORAGE_DIR)
  : defaultStorageDir;

export const config = {
  env: _env.data.NODE_ENV,
  port: parseInt(_env.data.PORT, 10),
  db: {
    url: _env.data.DATABASE_URL,
    ssl: _env.data.DATABASE_SSL === 'true' || _env.data.DATABASE_URL.includes('sslmode=require'),
    sslCa: _env.data.DATABASE_SSL_CA,
  },
  jwt: {
    secret: _env.data.JWT_SECRET,
  },
  logLevel: _env.data.LOG_LEVEL,
  storage: {
    dir: resolvedStorageDir,
  },
  corsOrigin: _env.data.CORS_ORIGIN || '*',
  backup: {
    dir: _env.data.BACKUP_DIR ? path.resolve(_env.data.BACKUP_DIR) : path.resolve(__dirname, '../../../backups'),
    retentionCount: parseInt(_env.data.BACKUP_RETENTION_COUNT || '7', 10),
    retentionDays: parseInt(_env.data.BACKUP_RETENTION_DAYS || '30', 10),
  },
};
