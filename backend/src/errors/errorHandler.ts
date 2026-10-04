import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';
import { logger } from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    } else {
      logger.warn({ err }, err.message);
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        fields: err.fields,
      },
    });
  }

  // Handle postgres errors gracefully without exposing raw queries
  // Specific mapped pg errors could be caught here (e.g., unique violation, check constraint)
  if ((err as any).code && typeof (err as any).code === 'string') {
    logger.error({ err, pgCode: (err as any).code }, 'Database constraint violation');
    
    // Very basic mapping for demo, actual app will map constraints specifically
    const isConstraint = ['23505', '23514', '23503'].includes((err as any).code);
    if (isConstraint) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'A database constraint was violated.',
        },
      });
    }
  }

  // Fallback
  logger.error({ err }, 'Unhandled internal server error');
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected server error occurred.',
    },
  });
};
