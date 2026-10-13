import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './bill-templates.controller';
import * as schema from './bill-templates.schema';

export const billTemplatesRouter = Router();
billTemplatesRouter.use(authenticate);

// List and Detail
billTemplatesRouter.get(
  '/',
  requireRole(['OWNER', 'STAFF', 'CA']),
  validateRequest(schema.listTemplatesSchema),
  controller.list
);

// Preview & Import
billTemplatesRouter.post(
  '/preview',
  requireRole(['OWNER', 'STAFF']),
  validateRequest(schema.previewTemplateSchema),
  controller.preview
);

billTemplatesRouter.post(
  '/import',
  requireRole(['OWNER']),
  validateRequest(schema.importTemplateSchema),
  controller.importTemplate
);

billTemplatesRouter.get(
  '/:id',
  requireRole(['OWNER', 'STAFF', 'CA']),
  controller.get
);

// Template Mutations (Owner-only)
billTemplatesRouter.post(
  '/',
  requireRole(['OWNER']),
  validateRequest(schema.createTemplateSchema),
  controller.create
);

billTemplatesRouter.patch(
  '/:id',
  requireRole(['OWNER']),
  validateRequest(schema.updateTemplateSchema),
  controller.update
);

billTemplatesRouter.delete(
  '/:id',
  requireRole(['OWNER']),
  controller.remove
);

// Asset Management
billTemplatesRouter.post(
  '/:id/assets',
  requireRole(['OWNER']),
  validateRequest(schema.uploadAssetSchema),
  controller.uploadAsset
);

billTemplatesRouter.get(
  '/:id/assets/:assetId/file',
  requireRole(['OWNER', 'STAFF', 'CA']),
  controller.getAssetFile
);

billTemplatesRouter.delete(
  '/:id/assets/:assetId',
  requireRole(['OWNER']),
  controller.deleteAsset
);
