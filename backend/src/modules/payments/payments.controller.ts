
import { Request, Response, NextFunction } from 'express';
import * as service from './payments.service';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.createPayment(req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.editPayment((req.params.id as string), req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const reverse = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await service.reversePayment((req.params.id as string), req.body.reversal_reason, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const utilizeCredit = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.utilizeCredit(req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};

export const fifo = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json({ success: true, data: await service.fifoAllocation(req.body, req.user!.id) }); } 
  catch (error) { next(error); }
};
