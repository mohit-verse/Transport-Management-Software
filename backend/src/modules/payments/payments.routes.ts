
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './payments.controller';
import * as schema from './payments.schema';

export const paymentsRouter = Router();
paymentsRouter.use(authenticate);

// STAFF and OWNER can create and edit
paymentsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.createPaymentSchema), controller.create);
paymentsRouter.patch('/:id', requireRole(['OWNER', 'STAFF']), validateRequest(schema.updatePaymentSchema), controller.update);

// ONLY OWNER can reverse
paymentsRouter.post('/:id/reverse', requireRole(['OWNER']), validateRequest(schema.reversePaymentSchema), controller.reverse);

// OWNER and STAFF can utilize credit
paymentsRouter.post('/credits/utilize', requireRole(['OWNER', 'STAFF']), validateRequest(schema.utilizeCreditSchema), controller.utilizeCredit);

// ONLY OWNER can do FIFO bulk
paymentsRouter.post('/fifo', requireRole(['OWNER']), validateRequest(schema.fifoAllocationSchema), controller.fifo);
