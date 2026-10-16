import fs from 'fs';
import path from 'path';
import { Pool, PoolConfig } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

const poolConfig: PoolConfig = {
  connectionString: config.db.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (config.db.ssl) {
  let sslCa = config.db.sslCa;
  if (sslCa && fs.existsSync(sslCa)) {
    sslCa = fs.readFileSync(sslCa, 'utf8');
  } else if (!sslCa) {
    const defaultCaPath = path.resolve(__dirname, '../../certs/prod-ca-2021.crt');
    if (fs.existsSync(defaultCaPath)) {
      sslCa = fs.readFileSync(defaultCaPath, 'utf8');
    }
  }

  poolConfig.ssl = {
    rejectUnauthorized: true, // Never disable certificate verification
    ca: sslCa || undefined,
  };
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error(err, 'Unexpected error on idle pg client');
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
