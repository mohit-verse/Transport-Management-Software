
import { Request, Response, NextFunction } from 'express';
import * as service from './documents.service';
import { storageService } from '../../services/storage.service';
import { AppError } from '../../errors/AppError';

const checkDocumentEntityAccess = (userRole: string, entityType?: string | null) => {
  if (userRole === 'CA') {
    const CA_ALLOWED_ENTITIES = ['PAYMENT', 'BILL', 'PARTY', 'TRIP'];
    if (entityType && !CA_ALLOWED_ENTITIES.includes(entityType.toUpperCase())) {
      throw new AppError('FORBIDDEN', 'CA role is not authorized to access documents for this entity type.', 403);
    }
  }
};

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try { 
    const mockFile = {
      name: req.body.file_name || 'pod.pdf',
      path: '/uploads/pod.pdf',
      mime: req.body.mime_type || 'application/pdf',
      size: req.body.file_size_bytes || 1024
    };
    res.status(201).json({ success: true, data: await service.uploadPOD(req.body.trip_id, mockFile, req.user!.id) }); 
  } 
  catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let entityType = (req.query.entity_type as string) || (req.query.trip_id ? 'TRIP' : undefined);
    if (entityType) {
      const upper = entityType.toUpperCase();
      entityType = upper === 'OWN_FLEET' ? 'OWN_FLEET_VEHICLE' : upper;
    }
    const entityId = (req.query.entity_id as string) || (req.query.trip_id as string | undefined);
    const documentType = req.query.document_type as string | undefined;
    const expiryStatus = req.query.expiry_status ? String(req.query.expiry_status).toUpperCase() as any : undefined;
    const search = (req.query.search as string) || (req.query.q as string) || undefined;

    const data = await service.listDocuments({
      entityType,
      entityId,
      documentType,
      expiryStatus,
      search,
      userRole: req.user?.role
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const uploadGenericDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await service.uploadDocument(req.body, req.user!.id);
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

export const replaceDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await service.replaceDocument(
      req.params.id as string,
      req.body,
      req.user!.id,
      req.user!.role
    );
    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
};

export const deleteDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.deleteDocument(
      req.params.id as string,
      req.body?.reason,
      req.user!.id,
      req.user!.role
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const uploadOwnFleetDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vehicle_id, document_type, expiry_date, file_name, mime_type, file_size_bytes } = req.body;
    const mockFile = {
      name: file_name || 'doc.pdf',
      path: '/uploads/doc.pdf',
      mime: mime_type || 'application/pdf',
      size: file_size_bytes || 1024
    };
    res.status(201).json({ 
      success: true, 
      data: await service.uploadOwnFleetDoc(vehicle_id, document_type, expiry_date, mockFile, req.user!.id, req.user!.role) 
    });
  } catch (error) {
    next(error);
  }
};

export const getMetadata = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await service.getDocumentMetadata(req.params.id as string);
    checkDocumentEntityAccess(req.user!.role, doc.entity_type);
    // Don't expose storage_key and storage_provider to the user
    const { storage_key, storage_provider, ...safeDoc } = doc;
    res.json({ success: true, data: safeDoc });
  } catch (error) {
    next(error);
  }
};

export const getFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await service.getDocumentMetadata(req.params.id as string);
    checkDocumentEntityAccess(req.user!.role, doc.entity_type);
    
    // Check if file exists in storage without exposing internal filesystem path
    const fileExists = await storageService.exists(doc.storage_key);
    if (!fileExists) {
      throw new AppError('NOT_FOUND', 'Requested document file is unavailable in storage.', 404);
    }

    const stream = storageService.getStream(doc.storage_key);
    
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
    
    stream.pipe(res);
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        next(new AppError('INTERNAL_SERVER_ERROR', 'Failed to stream document file.', 500));
      } else {
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPaymentDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payment_id, document_type, file_name, mime_type, file_size_bytes } = req.body;
    const mockFile = {
      name: file_name || 'payment_receipt.pdf',
      path: '/uploads/payment_receipt.pdf',
      mime: mime_type || 'application/pdf',
      size: file_size_bytes || 1024
    };
    res.status(201).json({
      success: true,
      data: await service.uploadPaymentDoc(payment_id, document_type, mockFile, req.user!.id)
    });
  } catch (error) {
    next(error);
  }
};

