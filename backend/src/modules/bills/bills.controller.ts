import { Request, Response, NextFunction } from 'express';
import * as service from './bills.service';
import { AppError } from '../../errors/AppError';

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
    const result = await service.listBills(req.query);
    res.json({ success: true, ...result });
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

export const getEligibleTrips = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partyId = req.query.party_id as string;
    if (!partyId) {
      throw new AppError('VALIDATION_ERROR', 'party_id query parameter is required', 400);
    }
    res.json({ success: true, data: await service.getEligibleTrips(partyId) });
  } catch (error) {
    next(error);
  }
};

export const getNumberingSeries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partyId = req.query.party_id as string | undefined;
    const fyId = req.query.financial_year_id as string | undefined;
    res.json({ success: true, data: await service.getNumberingSeries(partyId, fyId) });
  } catch (error) {
    next(error);
  }
};

export const getBillVersion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionNumber = parseInt(req.params.versionNumber as string, 10);
    if (isNaN(versionNumber)) {
      throw new AppError('VALIDATION_ERROR', 'versionNumber must be an integer', 400);
    }
    res.json({ success: true, data: await service.getBillVersion(req.params.id as string, versionNumber) });
  } catch (error) {
    next(error);
  }
};

export const getBillPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionQuery = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
    const result = await service.getBillPdf(req.params.id as string, versionQuery);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Bill-${result.billNumber}-v${result.versionNumber}.pdf"`);
    result.stream.pipe(res);
    result.stream.on('error', (err) => {
      if (!res.headersSent) {
        next(err);
      } else {
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getBillVersionPdf = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionNumber = parseInt(req.params.versionNumber as string, 10);
    if (isNaN(versionNumber)) {
      throw new AppError('VALIDATION_ERROR', 'versionNumber must be an integer', 400);
    }
    const result = await service.getBillPdf(req.params.id as string, versionNumber);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Bill-${result.billNumber}-v${result.versionNumber}.pdf"`);
    result.stream.pipe(res);
    result.stream.on('error', (err) => {
      if (!res.headersSent) {
        next(err);
      } else {
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
};
