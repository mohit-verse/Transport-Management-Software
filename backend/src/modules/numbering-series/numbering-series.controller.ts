import { Request, Response, NextFunction } from 'express';
import * as service from './numbering-series.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      party_id: req.query.party_id as string | undefined,
      financial_year_id: req.query.financial_year_id as string | undefined,
      is_active: req.query.is_active as unknown as boolean | undefined
    };
    const series = await service.listSeries(filters);
    res.json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const series = await service.getSeriesById(req.params.id as string);
    res.json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const series = await service.createSeries(req.body, req.user!.id);
    res.status(201).json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const series = await service.updateSeries(req.params.id as string, req.body, req.user!.id);
    res.json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction) {
  try {
    const series = await service.deactivateSeries(req.params.id as string, req.user!.id);
    res.json({ success: true, data: series });
  } catch (error) {
    next(error);
  }
}
