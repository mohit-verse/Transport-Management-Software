
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './trips.controller';
import * as schema from './trips.schema';

export const tripsRouter = Router();
tripsRouter.use(authenticate);

tripsRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), controller.list);
tripsRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.getById);
tripsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createTripSchema), controller.create);
tripsRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updateCoreTripSchema), controller.updateCore);
tripsRouter.patch('/:id/status', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updateStatusSchema), controller.updateStatus);
tripsRouter.patch('/:id/financials', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updateFinancialsSchema), controller.updateFinancials);
tripsRouter.post('/:id/issues', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createIssueSchema), controller.createIssue);
