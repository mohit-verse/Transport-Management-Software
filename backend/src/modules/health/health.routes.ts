import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../../db';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbRes = await pool.query('SELECT 1 as connected');
    const isDbConnected = dbRes.rows[0].connected === 1;

    res.json({
      success: true,
      data: {
        status: 'UP',
        database: isDbConnected ? 'UP' : 'DOWN',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'UP',
        database: 'DOWN',
        timestamp: new Date().toISOString()
      }
    });
  }
});
