import { Request, Response, NextFunction } from 'express';
import * as service from './reports.service';

export const getFinancialSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getFinancialSummary(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPnl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getPnl(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getIncoming = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getIncoming(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getOutgoing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getOutgoing(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getPaymentModes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getPaymentModes(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getCredits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getCredits(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getTds = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getTds(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getBillReconciliation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getBillReconciliation(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getFinancialYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await service.getFinancialYear(req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
