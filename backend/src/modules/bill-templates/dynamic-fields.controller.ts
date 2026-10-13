import { Request, Response, NextFunction } from 'express';
import * as service from './dynamic-fields.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      source_entity: req.query.source_entity as string | undefined,
      search: req.query.search as string | undefined,
      is_repeatable: req.query.is_repeatable as unknown as boolean | undefined
    };
    const fields = await service.listDynamicFields(filters);
    res.json({ success: true, data: fields });
  } catch (error) {
    next(error);
  }
}
