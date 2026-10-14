
import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './documents.controller';
import * as schema from './documents.schema';

export const documentsRouter = Router();
documentsRouter.use(authenticate);

documentsRouter.post('/pod', requireRole(['OWNER', 'STAFF']), validateRequest(schema.uploadPODSchema), controller.upload);
documentsRouter.post('/own-fleet', requireRole(['OWNER', 'STAFF']), validateRequest(schema.uploadOwnFleetDocSchema), controller.uploadOwnFleetDoc);
documentsRouter.post('/payment', requireRole(['OWNER', 'STAFF']), validateRequest(schema.uploadPaymentDocSchema), controller.uploadPaymentDoc);
documentsRouter.post('/', requireRole(['OWNER', 'STAFF']), validateRequest(schema.uploadDocumentSchema), controller.uploadGenericDoc);

documentsRouter.get('/', requireRole(['OWNER', 'STAFF', 'CA']), validateRequest(schema.listDocumentsQuerySchema), controller.list);
documentsRouter.get('/:id', requireRole(['OWNER', 'STAFF', 'CA']), controller.getMetadata);
documentsRouter.get('/:id/file', requireRole(['OWNER', 'STAFF', 'CA']), controller.getFile);

documentsRouter.post('/:id/replace', requireRole(['OWNER']), validateRequest(schema.replaceDocumentSchema), controller.replaceDoc);
documentsRouter.delete('/:id', requireRole(['OWNER']), validateRequest(schema.deleteDocumentSchema), controller.deleteDoc);
