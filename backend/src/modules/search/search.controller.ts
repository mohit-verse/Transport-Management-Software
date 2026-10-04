import { Request, Response } from 'express';
import { globalSearch } from './search.service';

export const search = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const q = req.query.q as string || '';
    
    const results = await globalSearch(user, q);

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Search Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to perform search.'
      }
    });
  }
};
