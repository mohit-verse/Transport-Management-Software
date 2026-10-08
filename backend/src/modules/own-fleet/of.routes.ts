
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './of.controller';
import * as schema from './of.schema';

export const ofRouter = Router();
ofRouter.use(authenticate);
ofRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.list);
ofRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.get);
ofRouter.get('/:id/trips', requireRole(['OWNER', 'STAFF', 'CA']), controller.trips);
ofRouter.get('/:id/expenses', requireRole(['OWNER', 'STAFF', 'CA']), controller.expenses);
ofRouter.post('/', requireRole(['OWNER']), validateRequest(schema.createOfSchema), controller.create);
ofRouter.patch('/:id', requireRole(['OWNER']), validateRequest(schema.updateOfSchema), controller.update);
ofRouter.post('/:id/maintenance', requireRole(['OWNER']), controller.maintenance);
ofRouter.post('/:id/sold', requireRole(['OWNER']), controller.sold);
