import { Request, Response, NextFunction } from 'express';
import * as service from './other-business.service';

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.query.type as string | undefined;
    const categories = await service.getOtherBusinessCategories(type);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};
