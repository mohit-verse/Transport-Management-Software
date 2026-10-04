import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './bills.controller';
import * as schema from './bills.schema';

export const billsRouter = Router();
billsRouter.use(authenticate);

billsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.generateBillSchema), controller.generate);
billsRouter.post('/eligibility', requireRole(['OWNER', 'STAFF']), validateRequest(schema.checkEligibilitySchema), controller.checkEligibility);
billsRouter.get('/', requireRole(['OWNER', 'STAFF']), controller.listBills);
billsRouter.get('/:id', requireRole(['OWNER', 'STAFF']), controller.getBill);
billsRouter.post('/:id/submit', requireRole(['OWNER', 'STAFF']), controller.submitBill);
billsRouter.post('/:id/cancel', requireRole(['OWNER']), validateRequest(schema.cancelBillSchema), controller.cancelBill);
billsRouter.post('/:id/versions', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createVersionSchema), controller.createVersion);
