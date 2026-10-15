import { app } from './app';
import { config } from './config';
import { pool } from './db';
import { logger } from './utils/logger';

const startServer = async () => {
  try {
    // Validate database connection
    await pool.query('SELECT 1');
    logger.info('Connected to PostgreSQL successfully');

    const server = app.listen(config.port, () => {
      logger.info(`Server listening on port ${config.port} in ${config.env} mode`);
    });

    const shutdown = async () => {
      logger.info('Shutting down server...');
      if (typeof (server as any).closeIdleConnections === 'function') {
        (server as any).closeIdleConnections();
      }
      server.close(async () => {
        logger.info('HTTP server closed');
        await pool.end();
        logger.info('Database pool closed');
        process.exit(0);
      });

      // Force close after 10s fallback
      const forceTimer = setTimeout(() => {
        if (typeof (server as any).closeAllConnections === 'function') {
          (server as any).closeAllConnections();
        }
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
      forceTimer.unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
