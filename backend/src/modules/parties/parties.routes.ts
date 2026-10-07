
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
partiesRouter.get('/:id/financials', requireRole(['OWNER', 'STAFF', 'CA']), controller.getFinancials);
partiesRouter.get('/:id/trips', requireRole(['OWNER', 'STAFF', 'CA']), controller.getTrips);
partiesRouter.get('/:id/bills', requireRole(['OWNER', 'STAFF', 'CA']), controller.getBills);
partiesRouter.get('/:id/payments', requireRole(['OWNER', 'STAFF', 'CA']), controller.getPayments);

partiesRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createPartySchema), controller.create);
partiesRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updatePartySchema), controller.update);

partiesRouter.patch('/:id/billing-config', requireRole(['OWNER']), validateRequest(schema.updateBillingConfigSchema), controller.updateConfig);
