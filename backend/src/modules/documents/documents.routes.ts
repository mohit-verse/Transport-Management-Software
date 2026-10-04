
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './documents.controller';
import * as schema from './documents.schema';

export const documentsRouter = Router();
documentsRouter.use(authenticate);

documentsRouter.post('/pod', requireRole(['OWNER', 'STAFF']), validateRequest(schema.uploadPODSchema), controller.upload);
