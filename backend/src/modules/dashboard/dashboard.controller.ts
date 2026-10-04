import { Request, Response } from 'express';
import { getDashboardData } from './dashboard.service';

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const query = req.query;
    
    const dashboardData = await getDashboardData(user, query);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    console.error('Dashboard Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to load dashboard data.'
      }
    });
  }
};
