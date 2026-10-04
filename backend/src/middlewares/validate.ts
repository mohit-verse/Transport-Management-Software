import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export const validateRequest = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        error.errors.forEach((e: any) => {
          const path = e.path.join('.');
          fields[path] = e.message;
        });

        next(new AppError('VALIDATION_ERROR', 'Request contains invalid fields.', 400, fields));
        return;
      }
      next(error);
    }
  };
};
