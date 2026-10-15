import { Pool, PoolConfig } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  connectionString: config.db.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (config.db.ssl) {
  poolConfig.ssl = {
    rejectUnauthorized: true, // Never disable certificate verification
    ca: config.db.sslCa || undefined,
  };
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error(err, 'Unexpected error on idle pg client');
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
