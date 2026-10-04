import { Router } from 'express';
import { getDashboard } from './dashboard.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, getDashboard);

export default router;
