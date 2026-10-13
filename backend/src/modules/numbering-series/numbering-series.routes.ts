import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { validateRequest } from '../../middlewares/validate';
import * as controller from './numbering-series.controller';
import * as schema from './numbering-series.schema';

export const numberingSeriesRouter = Router();
numberingSeriesRouter.use(authenticate);

numberingSeriesRouter.get(
  '/',
  requireRole(['OWNER', 'STAFF', 'CA']),
  validateRequest(schema.listNumberingSeriesSchema),
  controller.list
);

numberingSeriesRouter.get(
  '/:id',
  requireRole(['OWNER', 'STAFF', 'CA']),
  controller.get
);

numberingSeriesRouter.post(
  '/',
  requireRole(['OWNER']),
  validateRequest(schema.createNumberingSeriesSchema),
  controller.create
);

numberingSeriesRouter.patch(
  '/:id',
  requireRole(['OWNER']),
  validateRequest(schema.updateNumberingSeriesSchema),
  controller.update
);

numberingSeriesRouter.post(
  '/:id/deactivate',
  requireRole(['OWNER']),
  controller.deactivate
);
