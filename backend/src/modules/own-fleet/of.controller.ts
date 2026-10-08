
import { Request, Response, NextFunction } from 'express';
import * as service from './of.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.createVehicle(req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.getVehicles() }); } 
  catch (error) { next(error); }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.getVehicleById((req.params.id as string)) }); } 
  catch (error) { next(error); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.updateVehicle((req.params.id as string), req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const maintenance = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.setMaintenance((req.params.id as string), req.body.is_maintenance, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const sold = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.setSold((req.params.id as string), req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const trips = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.getVehicleTrips(req.params.id as string) }); } 
  catch (error) { next(error); }
};

export const expenses = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.getVehicleExpenses(req.params.id as string) }); } 
  catch (error) { next(error); }
};
