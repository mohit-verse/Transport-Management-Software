
import { Request, Response, NextFunction } from 'express';
import * as service from './documents.service';

export const upload = async (req: Request, res: Response, next: NextFunction) => {
  try { 
    // In a real implementation, multer or similar would provide req.file
    const mockFile = { name: 'pod.pdf', path: '/uploads/pod.pdf', mime: 'application/pdf', size: 1024 };
    res.status(201).json({ success: true, data: await service.uploadPOD(req.body.trip_id, mockFile, req.user!.id) }); 
  } 
  catch (error) { next(error); }
};

export const list = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.query.entity_type as string | undefined;
    const entityId = req.query.entity_id as string | undefined;
    
    // Fallback for older trip_id query
    const tripId = req.query.trip_id as string | undefined;
    if (!entityType && tripId) {
      res.json({ success: true, data: await service.listDocuments('TRIP', tripId) });
      return;
    }

    res.json({ success: true, data: await service.listDocuments(entityType, entityId) });
  } catch (error) {
    next(error);
  }
};

export const uploadOwnFleetDoc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vehicle_id, document_type, expiry_date } = req.body;
    const mockFile = { name: 'doc.pdf', path: '/uploads/doc.pdf', mime: 'application/pdf', size: 1024 };
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
    // Don't expose storage_key and storage_provider to the user
    const { storage_key, storage_provider, ...safeDoc } = doc;
    res.json({ success: true, data: safeDoc });
  } catch (error) {
    next(error);
  }
};

import { storageService } from '../../services/storage.service';

export const getFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await service.getDocumentMetadata(req.params.id as string);
    
    // RBAC: Enforced by requireRole middleware on the route (OWNER, STAFF, CA)
    // The user has access to TRIP entity globally in this setup, so no row-level check is needed for now.
    
    const stream = storageService.getStream(doc.storage_key);
    
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_name}"`);
    
    stream.pipe(res);
    
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      // Can't send error response if headers are already sent, so just end
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
