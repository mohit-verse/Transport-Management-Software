import { Request, Response, NextFunction } from 'express';
import * as service from './payments.service';

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listPayments(req.query as any);
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
};

export const get = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await service.getPaymentById(req.params.id as string);
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await service.createPayment(req.body, req.user!.id);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await service.editPayment(req.params.id as string, req.body, req.user!.id);
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const reallocate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await service.reallocatePayment(req.params.id as string, req.body, req.user!.id);
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const reverse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await service.reversePayment(req.params.id as string, req.body.reversal_reason, req.user!.id);
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
};

export const utilizeCredit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await service.utilizeCredit(req.body, req.user!.id);
    res.status(201).json({ success: true, data: allocation });
  } catch (error) {
    next(error);
  }
};

export const fifo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.fifoAllocation(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getFifoRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await service.getPaymentFifoRuns(req.params.id as string);
    res.json({ success: true, data: runs });
  } catch (error) {
    next(error);
  }
};

export const getAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const audit = await service.getPaymentAuditHistory(req.params.id as string);
    res.json({ success: true, data: audit });
  } catch (error) {
    next(error);
  }
};
