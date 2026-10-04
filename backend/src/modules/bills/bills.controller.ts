import { Request, Response, NextFunction } from 'express';
import * as service from './bills.service';

export const generate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await service.generateBill(req.body, req.user!.id) });
  } catch (error) {
    next(error);
  }
};

export const checkEligibility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await service.checkEligibility(req.body) });
  } catch (error) {
    next(error);
  }
};

export const listBills = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await service.listBills(req.query) });
  } catch (error) {
    next(error);
  }
};

export const getBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await service.getBill(req.params.id as string) });
  } catch (error) {
    next(error);
  }
};

export const submitBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await service.submitBill(req.params.id as string, req.user!.id) });
  } catch (error) {
    next(error);
  }
};

export const cancelBill = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await service.cancelBill(req.params.id as string, req.body.cancel_reason, req.user!.id) });
  } catch (error) {
    next(error);
  }
};

export const createVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ success: true, data: await service.createVersion(req.params.id as string, req.body, req.user!.id) });
  } catch (error) {
    next(error);
  }
};
