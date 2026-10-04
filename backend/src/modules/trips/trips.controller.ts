
import { Request, Response, NextFunction } from 'express';
import * as service from './trips.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.createTrip(req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.getTrips() }); } 
  catch (error) { next(error); }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.updateStatus((req.params.id as string), req.body.status, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const updateFinancials = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.updateFinancials((req.params.id as string), req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const createIssue = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.createIssue((req.params.id as string), req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};
