import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './bills.controller';
import * as schema from './bills.schema';

export const billsRouter = Router();
billsRouter.use(authenticate);

// List and Discovery Endpoints
billsRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), validateRequest(schema.listBillsSchema), controller.listBills);
billsRouter.get('/eligible-trips', requireRole(['OWNER', 'STAFF']), validateRequest(schema.getEligibleTripsSchema), controller.getEligibleTrips);
billsRouter.get('/numbering-series', requireRole(['OWNER', 'STAFF', 'CA']), validateRequest(schema.getNumberingSeriesSchema), controller.getNumberingSeries);

// Generation and Eligibility Verification
billsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.generateBillSchema), controller.generate);
billsRouter.post('/eligibility', requireRole(['OWNER', 'STAFF']), validateRequest(schema.checkEligibilitySchema), controller.checkEligibility);

// Single Bill Details, PDF, and Historical Versions
billsRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.getBill);
billsRouter.get('/:id/pdf', requireRole(['OWNER', 'STAFF', 'CA']), controller.getBillPdf);
billsRouter.get('/:id/versions/:versionNumber', requireRole(['OWNER', 'STAFF', 'CA']), controller.getBillVersion);

// Mutations
billsRouter.post('/:id/submit', requireRole(['OWNER', 'STAFF']), controller.submitBill);
billsRouter.post('/:id/cancel', requireRole(['OWNER']), validateRequest(schema.cancelBillSchema), controller.cancelBill);
billsRouter.post('/:id/versions', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createVersionSchema), controller.createVersion);
