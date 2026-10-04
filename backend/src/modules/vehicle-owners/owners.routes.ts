
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './owners.controller';
import * as schema from './owners.schema';

export const ownersRouter = Router();

ownersRouter.use(authenticate);

ownersRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.list);
ownersRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.get);

ownersRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createOwnerSchema), controller.create);
ownersRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updateOwnerSchema), controller.update);
