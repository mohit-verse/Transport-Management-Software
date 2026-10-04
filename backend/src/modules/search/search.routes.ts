import { Router } from 'express';
import { search } from './search.controller';
import { authenticate } from '../../middlewares/auth';

const router = Router();

router.get('/', authenticate, search);

export default router;
