import { Request, Response, NextFunction } from 'express';
import { login, getUserById } from './auth.service';

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mobile_number, password } = req.body;
    const token = await login(mobile_number, password);
    res.json({ success: true, data: { token } });
  } catch (error) {
    next(error);
  }
};

export const meHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const user = await getUserById(userId);
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
