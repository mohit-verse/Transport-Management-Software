import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { query } from '../../db';

export const financialYearsRouter = Router();
financialYearsRouter.use(authenticate);

financialYearsRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, code, start_date, end_date, is_active FROM financial_years ORDER BY start_date DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});
