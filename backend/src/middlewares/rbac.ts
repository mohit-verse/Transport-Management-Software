import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

export type Role = 'OWNER' | 'STAFF' | 'CA';

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('UNAUTHENTICATED', 'Not authenticated.', 401));
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return next(new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403));
    }

    next();
  };
};
