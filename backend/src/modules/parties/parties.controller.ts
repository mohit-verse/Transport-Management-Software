
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

export const getFinancials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const financials = await service.getPartyFinancials((req.params.id as string));
    res.json({ success: true, data: financials });
  } catch (error) { next(error); }
};

export const getTrips = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const trips = await service.getPartyTrips((req.params.id as string), limit);
    res.json({ success: true, data: trips });
  } catch (error) { next(error); }
};

export const getBills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const bills = await service.getPartyBills((req.params.id as string), limit);
    res.json({ success: true, data: bills });
  } catch (error) { next(error); }
};

export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const payments = await service.getPartyPayments((req.params.id as string), limit);
    res.json({ success: true, data: payments });
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
