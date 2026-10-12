import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './payments.controller';
import * as schema from './payments.schema';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

// Read endpoints (OWNER, STAFF, CA)
paymentsRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), validateRequest(schema.listPaymentsQuerySchema), controller.list);
paymentsRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.get);
paymentsRouter.get('/:id/fifo', requireRole(['OWNER', 'STAFF', 'CA']), controller.getFifoRuns);
paymentsRouter.get('/:id/audit', requireRole(['OWNER', 'STAFF', 'CA']), controller.getAudit);

// Creation and basic edits (STAFF and OWNER)
paymentsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createPaymentSchema), controller.create);
paymentsRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updatePaymentSchema), controller.update);

// Reallocation (OWNER only)
paymentsRouter.post('/:id/reallocate', requireRole(['OWNER']), validateRequest(schema.reallocatePaymentSchema), controller.reallocate);

// Reversal (OWNER only)
paymentsRouter.post('/:id/reverse', requireRole(['OWNER']), validateRequest(schema.reversePaymentSchema), controller.reverse);

// Credit utilization (OWNER and STAFF)
paymentsRouter.post('/credits/utilize', requireRole(['OWNER', 'STAFF']), validateRequest(schema.utilizeCreditSchema), controller.utilizeCredit);

// FIFO bulk allocation (OWNER only)
paymentsRouter.post('/fifo', requireRole(['OWNER']), validateRequest(schema.fifoAllocationSchema), controller.fifo);
