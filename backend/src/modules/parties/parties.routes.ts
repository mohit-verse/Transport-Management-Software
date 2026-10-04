
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './parties.controller';
import * as schema from './parties.schema';

export const partiesRouter = Router();

partiesRouter.use(authenticate);

partiesRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.list);
partiesRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.get);

partiesRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createPartySchema), controller.create);
partiesRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updatePartySchema), controller.update);

partiesRouter.patch('/:id/billing-config', requireRole(['OWNER']), validateRequest(schema.updateBillingConfigSchema), controller.updateConfig);
