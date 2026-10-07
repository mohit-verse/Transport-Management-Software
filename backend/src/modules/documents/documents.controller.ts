
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
    const tripId = req.query.trip_id as string | undefined;
    res.json({ success: true, data: await service.listDocuments(tripId) });
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
