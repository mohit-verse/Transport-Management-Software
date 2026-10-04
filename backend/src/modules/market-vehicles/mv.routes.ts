
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './mv.controller';
import * as schema from './mv.schema';

export const mvRouter = Router();
mvRouter.use(authenticate);
mvRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.list);
mvRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.get);
mvRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createMvSchema), controller.create);
mvRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updateMvSchema), controller.update);
