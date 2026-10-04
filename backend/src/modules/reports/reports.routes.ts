import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './reports.controller';
import * as schema from './reports.schema';

export const reportsRouter = Router();

// All reporting requires auth
reportsRouter.use(authenticate);

// We allow OWNER, STAFF, CA to view reports. 
// Note: CA role has read-only access to financials.
const reportRoles: any[] = ['OWNER', 'STAFF', 'CA'];

reportsRouter.get('/financial-summary', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getFinancialSummary);
reportsRouter.get('/pnl', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getPnl);
reportsRouter.get('/incoming', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getIncoming);
reportsRouter.get('/outgoing', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getOutgoing);
reportsRouter.get('/payment-modes', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getPaymentModes);
reportsRouter.get('/credits', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getCredits);
reportsRouter.get('/tds', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getTds);
reportsRouter.get('/bill-reconciliation', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getBillReconciliation);
reportsRouter.get('/financial-year', requireRole(reportRoles), validateRequest(schema.reportQuerySchema), controller.getFinancialYear);
