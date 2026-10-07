
import { Request, Response, NextFunction } from 'express';
import * as service from './owners.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owner = await service.createOwner(req.body, req.user!.id);
    res.status(201).json({ success: true, data: owner });
  } catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owners = await service.getOwners();
    res.json({ success: true, data: owners });
  } catch (error) { next(error); }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owner = await service.getOwnerById((req.params.id as string));
    res.json({ success: true, data: owner });
  } catch (error) { next(error); }
};

export const getFinancials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOwnerFinancials(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getVehicles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOwnerVehicles(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getTrips = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOwnerTrips(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOwnerPayments(req.params.id as string);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const owner = await service.updateOwner((req.params.id as string), req.body, req.user!.id);
    res.json({ success: true, data: owner });
  } catch (error) { next(error); }
};
