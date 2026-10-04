import { Router } from 'express';
import { loginHandler, meHandler } from './auth.controller';
import { authenticate } from '../../middlewares/auth';
import { validateRequest } from '../../middlewares/validate';
import { z } from 'zod';

export const authRouter = Router();

const loginSchema = z.object({
  body: z.object({
    mobile_number: z.string().min(10),
    password: z.string().min(1),
  }),
});

authRouter.post('/login', validateRequest(loginSchema), loginHandler);
authRouter.get('/me', authenticate, meHandler);
