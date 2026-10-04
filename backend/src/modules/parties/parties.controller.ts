
import { Request, Response, NextFunction } from 'express';
import * as service from './parties.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await service.createParty(req.body, req.user!.id);
    res.status(201).json({ success: true, data: party });
  } catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parties = await service.getParties();
    res.json({ success: true, data: parties });
  } catch (error) { next(error); }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await service.getPartyById((req.params.id as string));
    res.json({ success: true, data: party });
  } catch (error) { next(error); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await service.updateParty((req.params.id as string), req.body, req.user!.id);
    res.json({ success: true, data: party });
  } catch (error) { next(error); }
};

export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const party = await service.updateBillingConfig((req.params.id as string), req.body.billing_configuration, req.user!.id);
    res.json({ success: true, data: party });
  } catch (error) { next(error); }
};
