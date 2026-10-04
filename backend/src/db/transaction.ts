import { PoolClient } from 'pg';
import { pool } from './index';
import { logger } from '../utils/logger';

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err }, 'Transaction rolled back due to error');
    throw err;
  } finally {
    client.release();
  }
};
