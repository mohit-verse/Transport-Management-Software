import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import * as controller from './other-business.controller';

export const otherBusinessRouter = Router();
otherBusinessRouter.use(authenticate);

otherBusinessRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.listCategories);
