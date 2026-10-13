import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './dynamic-fields.controller';
import * as schema from './dynamic-fields.schema';

export const dynamicFieldsRouter = Router();
dynamicFieldsRouter.use(authenticate);

dynamicFieldsRouter.get(
  '/',
  requireRole(['OWNER', 'STAFF', 'CA']),
  validateRequest(schema.listDynamicFieldsSchema),
  controller.list
);
