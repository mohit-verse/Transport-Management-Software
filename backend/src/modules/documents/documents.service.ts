
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';
import { storageService } from '../../services/storage.service';

const saveMockPhysicalFile = (originalName: string): string => {
  const ext = path.extname(originalName) || '.pdf';
  const key = `documents/${crypto.randomUUID()}${ext}`;
  const baseDir = path.join(__dirname, '../../../../storage/development');
  const fullPath = path.join(baseDir, key);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, `%PDF-1.4 File content for ${originalName}`);
  return key;
};

export const uploadPOD = async (tripId: string, fileInfo: any, userId: string) => {
  let createdStorageKey: string | null = null;
  try {
    return await withTransaction(async (client) => {
      const storageKey = saveMockPhysicalFile(fileInfo.name || 'pod.pdf');
      createdStorageKey = storageKey;
      // Basic doc insert
      const sql = `
        INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by)
        VALUES ('POD', $1, 'LOCAL', $2, $3, $4, $5) RETURNING *
      `;
      const res = await client.query(sql, [fileInfo.name, storageKey, fileInfo.mime, fileInfo.size, userId]);
      const doc = res.rows[0];

      // Link
      await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'TRIP', $2)`, [doc.id, tripId]);

      // Update trip POD status
      await client.query(`UPDATE trip_pods SET pod_status = 'RECEIVED', pod_received_at = NOW(), updated_at = NOW() WHERE trip_id = $1`, [tripId]);

      await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD', newState: doc, userId }, client);
      return doc;
    });
  } catch (error) {
    if (createdStorageKey) {
      await storageService.delete(createdStorageKey).catch(() => {});
    }
    throw error;
  }
};

export interface ListDocumentFilters {
  entityType?: string;
  entityId?: string;
  documentType?: string;
  expiryStatus?: 'ALL' | 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE';
  search?: string;
  userRole?: string;
}

export const listDocuments = async (filtersOrEntityType?: ListDocumentFilters | string, maybeEntityId?: string) => {
  let filters: ListDocumentFilters = {};
  if (typeof filtersOrEntityType === 'string') {
    filters = { entityType: filtersOrEntityType, entityId: maybeEntityId };
  } else if (filtersOrEntityType) {
    filters = filtersOrEntityType;
  }

  let sql = `
    SELECT d.id, d.document_type, d.original_name, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at, d.expiry_date,
           CASE
             WHEN d.expiry_date IS NULL THEN NULL
             WHEN d.expiry_date < CURRENT_DATE THEN 'EXPIRED'
             WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
             ELSE 'ACTIVE'
           END as expiry_status,
           CASE
             WHEN d.expiry_date IS NULL THEN NULL
             ELSE (d.expiry_date - CURRENT_DATE)::integer
           END as days_to_expiry,
           dl.entity_type, dl.entity_id,
           u.name as uploaded_by_name,
           COALESCE(t.trip_number, ofv.vehicle_number, p.payment_id, b.bill_number, pty.name, vo.name, mv.vehicle_number) as entity_reference
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id
    LEFT JOIN users u ON u.id = d.uploaded_by
    LEFT JOIN trips t ON dl.entity_type = 'TRIP' AND t.id = dl.entity_id
    LEFT JOIN own_fleet_vehicles ofv ON dl.entity_type = 'OWN_FLEET_VEHICLE' AND ofv.id = dl.entity_id
    LEFT JOIN payments p ON dl.entity_type = 'PAYMENT' AND p.id = dl.entity_id
    LEFT JOIN bills b ON dl.entity_type = 'BILL' AND b.id = dl.entity_id
    LEFT JOIN parties pty ON dl.entity_type = 'PARTY' AND pty.id = dl.entity_id
    LEFT JOIN vehicle_owners vo ON dl.entity_type = 'VEHICLE_OWNER' AND vo.id = dl.entity_id
    LEFT JOIN market_vehicles mv ON dl.entity_type = 'MARKET_VEHICLE' AND mv.id = dl.entity_id
    WHERE d.is_deleted = false
  `;
  const params: any[] = [];
  let paramIndex = 1;

  // CA Role Scoping: CA can only access financial/tax/operational records (PAYMENT, BILL, PARTY, TRIP)
  if (filters.userRole === 'CA') {
    const CA_ALLOWED_ENTITIES = ['PAYMENT', 'BILL', 'PARTY', 'TRIP'];
    if (filters.entityType) {
      if (!CA_ALLOWED_ENTITIES.includes(filters.entityType)) {
        throw new AppError('FORBIDDEN', 'CA role is not authorized to access documents for this entity type.', 403);
      }
    } else {
      sql += ` AND dl.entity_type IN ('PAYMENT', 'BILL', 'PARTY', 'TRIP')`;
    }
  }

  if (filters.entityType) {
    sql += ` AND dl.entity_type = $${paramIndex++}`;
    params.push(filters.entityType);
  }

  if (filters.entityId) {
    sql += ` AND dl.entity_id = $${paramIndex++}`;
    params.push(filters.entityId);
  }

  if (filters.documentType) {
    sql += ` AND d.document_type = $${paramIndex++}`;
    params.push(filters.documentType);
  }

  if (filters.expiryStatus) {
    if (filters.expiryStatus === 'EXPIRED') {
      sql += ` AND d.expiry_date IS NOT NULL AND d.expiry_date < CURRENT_DATE`;
    } else if (filters.expiryStatus === 'EXPIRING_SOON') {
      sql += ` AND d.expiry_date IS NOT NULL AND d.expiry_date >= CURRENT_DATE AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'`;
    } else if (filters.expiryStatus === 'ACTIVE') {
      sql += ` AND (d.expiry_date IS NULL OR d.expiry_date >= CURRENT_DATE)`;
    }
  }

  if (filters.search && filters.search.trim()) {
    const s = `%${filters.search.trim()}%`;
    sql += ` AND (
      d.original_name ILIKE $${paramIndex} OR
      d.document_type ILIKE $${paramIndex} OR
      COALESCE(t.trip_number, ofv.vehicle_number, p.payment_id, b.bill_number, pty.name, vo.name, mv.vehicle_number) ILIKE $${paramIndex}
    )`;
    params.push(s);
    paramIndex++;
  }

  sql += ` ORDER BY d.uploaded_at DESC`;

  const res = await query(sql, params);
  return res.rows;
};

export const getDocumentMetadata = async (id: string) => {
  const sql = `
    SELECT d.id, d.document_type, d.original_name, d.storage_provider, d.storage_key, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at, d.expiry_date,
           CASE
             WHEN d.expiry_date IS NULL THEN NULL
             WHEN d.expiry_date < CURRENT_DATE THEN 'EXPIRED'
             WHEN d.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'EXPIRING_SOON'
             ELSE 'ACTIVE'
           END as expiry_status,
           CASE
             WHEN d.expiry_date IS NULL THEN NULL
             ELSE (d.expiry_date - CURRENT_DATE)::integer
           END as days_to_expiry,
           dl.entity_type, dl.entity_id,
           u.name as uploaded_by_name,
           COALESCE(t.trip_number, ofv.vehicle_number, p.payment_id, b.bill_number, pty.name, vo.name, mv.vehicle_number) as entity_reference
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id
    LEFT JOIN users u ON u.id = d.uploaded_by
    LEFT JOIN trips t ON dl.entity_type = 'TRIP' AND t.id = dl.entity_id
    LEFT JOIN own_fleet_vehicles ofv ON dl.entity_type = 'OWN_FLEET_VEHICLE' AND ofv.id = dl.entity_id
    LEFT JOIN payments p ON dl.entity_type = 'PAYMENT' AND p.id = dl.entity_id
    LEFT JOIN bills b ON dl.entity_type = 'BILL' AND b.id = dl.entity_id
    LEFT JOIN parties pty ON dl.entity_type = 'PARTY' AND pty.id = dl.entity_id
    LEFT JOIN vehicle_owners vo ON dl.entity_type = 'VEHICLE_OWNER' AND vo.id = dl.entity_id
    LEFT JOIN market_vehicles mv ON dl.entity_type = 'MARKET_VEHICLE' AND mv.id = dl.entity_id
    WHERE d.id = $1 AND d.is_deleted = false
  `;
  const res = await query(sql, [id]);
  if (res.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Document not found', 404);
  }
  return res.rows[0];
};

export const uploadDocument = async (
  payload: {
    entity_type: 'TRIP' | 'OWN_FLEET_VEHICLE' | 'PAYMENT' | 'BILL' | 'PARTY' | 'VEHICLE_OWNER' | 'MARKET_VEHICLE';
    entity_id: string;
    document_type: string;
    expiry_date?: string | null;
    file_name?: string;
    mime_type?: string;
    file_size_bytes?: number;
  },
  userId: string
) => {
  let createdStorageKey: string | null = null;
  try {
    return await withTransaction(async (client) => {
      // Validate parent entity existence
      let exists = false;
      if (payload.entity_type === 'TRIP') {
        const check = await client.query('SELECT id FROM trips WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'OWN_FLEET_VEHICLE') {
        const check = await client.query('SELECT id FROM own_fleet_vehicles WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'PAYMENT') {
        const check = await client.query('SELECT id FROM payments WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'BILL') {
        const check = await client.query('SELECT id FROM bills WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'PARTY') {
        const check = await client.query('SELECT id FROM parties WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'VEHICLE_OWNER') {
        const check = await client.query('SELECT id FROM vehicle_owners WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      } else if (payload.entity_type === 'MARKET_VEHICLE') {
        const check = await client.query('SELECT id FROM market_vehicles WHERE id = $1', [payload.entity_id]);
        exists = (check.rowCount ?? 0) > 0;
      }

      if (!exists) {
        throw new AppError('NOT_FOUND', `Associated ${payload.entity_type} record not found`, 404);
      }

      const originalName = payload.file_name || `${payload.document_type.toLowerCase()}_document.pdf`;
      const mimeType = payload.mime_type || 'application/pdf';
      const fileSize = payload.file_size_bytes || 1024;
      const storageKey = saveMockPhysicalFile(originalName);
      createdStorageKey = storageKey;

      const insertSql = `
        INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by, expiry_date)
        VALUES ($1, $2, 'LOCAL', $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const docRes = await client.query(insertSql, [
        payload.document_type,
        originalName,
        storageKey,
        mimeType,
        fileSize,
        userId,
        payload.expiry_date || null
      ]);
      const doc = docRes.rows[0];

      await client.query(
        `INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, $2, $3)`,
        [doc.id, payload.entity_type, payload.entity_id]
      );

      await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD', newState: doc, userId }, client);

      return doc;
    });
  } catch (error) {
    if (createdStorageKey) {
      await storageService.delete(createdStorageKey).catch(() => {});
    }
    throw error;
  }
};

export const replaceDocument = async (
  id: string,
  payload: {
    document_type?: string;
    expiry_date?: string | null;
    reason?: string;
    file_name?: string;
    mime_type?: string;
    file_size_bytes?: number;
  },
  userId: string,
  userRole: string
) => {
  if (userRole !== 'OWNER') {
    throw new AppError('FORBIDDEN', 'Only OWNER can replace documents', 403);
  }

  let createdStorageKey: string | null = null;
  try {
    return await withTransaction(async (client) => {
      const existing = await client.query(`
        SELECT d.*, dl.entity_type, dl.entity_id
        FROM documents d
        LEFT JOIN document_links dl ON dl.document_id = d.id
        WHERE d.id = $1 AND d.is_deleted = false
      `, [id]);

      if (existing.rowCount === 0) {
        throw new AppError('NOT_FOUND', 'Document not found', 404);
      }

      const oldDoc = existing.rows[0];

      // Soft delete the existing document
      await client.query(`UPDATE documents SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [id]);

      const docType = payload.document_type || oldDoc.document_type;
      const originalName = payload.file_name || `replaced_${oldDoc.original_name}`;
      const mimeType = payload.mime_type || oldDoc.mime_type || 'application/pdf';
      const fileSize = payload.file_size_bytes || oldDoc.file_size_bytes || 1024;
      const expiryDate = payload.expiry_date !== undefined ? payload.expiry_date : oldDoc.expiry_date;
      const storageKey = saveMockPhysicalFile(originalName);
      createdStorageKey = storageKey;

      const insertSql = `
        INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by, expiry_date)
        VALUES ($1, $2, 'LOCAL', $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const docRes = await client.query(insertSql, [
        docType,
        originalName,
        storageKey,
        mimeType,
        fileSize,
        userId,
        expiryDate || null
      ]);
      const newDoc = docRes.rows[0];

      if (oldDoc.entity_type && oldDoc.entity_id) {
        await client.query(
          `INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, $2, $3)`,
          [newDoc.id, oldDoc.entity_type, oldDoc.entity_id]
        );
      }

      await createAudit({
        entityType: 'DOCUMENT',
        entityId: newDoc.id,
        action: 'REPLACE',
        previousState: oldDoc,
        newState: { ...newDoc, reason: payload.reason || 'Document replaced by owner' },
        userId
      }, client);

      return newDoc;
    });
  } catch (error) {
    if (createdStorageKey) {
      await storageService.delete(createdStorageKey).catch(() => {});
    }
    throw error;
  }
};

export const deleteDocument = async (id: string, reason: string | undefined, userId: string, userRole: string) => {
  if (userRole !== 'OWNER') {
    throw new AppError('FORBIDDEN', 'Only OWNER can delete documents', 403);
  }

  return withTransaction(async (client) => {
    const existing = await client.query(`SELECT * FROM documents WHERE id = $1 AND is_deleted = false`, [id]);
    if (existing.rowCount === 0) {
      throw new AppError('NOT_FOUND', 'Document not found', 404);
    }

    const doc = existing.rows[0];
    await client.query(`UPDATE documents SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [id]);

    await createAudit({
      entityType: 'DOCUMENT',
      entityId: id,
      action: 'DELETE',
      previousState: { ...doc, reason: reason || 'Document soft-deleted by owner' },
      userId
    }, client);

    return { success: true, message: 'Document deleted successfully' };
  });
};

export const uploadOwnFleetDoc = async (vehicleId: string, documentType: string, expiryDate: string | undefined, fileInfo: any, userId: string, role: string) => {
  let createdStorageKey: string | null = null;
  try {
    return await withTransaction(async (client) => {
      const existingRes = await client.query(`
        SELECT d.id FROM documents d
        JOIN document_links dl ON dl.document_id = d.id
        WHERE dl.entity_type = 'OWN_FLEET_VEHICLE' AND dl.entity_id = $1 AND d.document_type = $2 AND d.is_deleted = false
      `, [vehicleId, documentType]);
      
      if (existingRes.rowCount && existingRes.rowCount > 0) {
        if (role !== 'OWNER') {
          throw new AppError('FORBIDDEN', 'Only OWNER can replace existing documents', 403);
        }
        await client.query(`UPDATE documents SET is_deleted = true, deleted_at = NOW() WHERE id = $1`, [existingRes.rows[0].id]);
      }

      const originalName = fileInfo.name || `${documentType.toLowerCase()}.pdf`;
      const storageKey = saveMockPhysicalFile(originalName);
      createdStorageKey = storageKey;

      const sql = `
        INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by, expiry_date)
        VALUES ($1, $2, 'LOCAL', $3, $4, $5, $6, $7) RETURNING *
      `;
      const res = await client.query(sql, [documentType, originalName, storageKey, fileInfo.mime, fileInfo.size, userId, expiryDate || null]);
      const doc = res.rows[0];

      await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'OWN_FLEET_VEHICLE', $2)`, [doc.id, vehicleId]);
      await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD_OWN_FLEET', newState: doc, userId }, client);
      
      return doc;
    });
  } catch (error) {
    if (createdStorageKey) {
      await storageService.delete(createdStorageKey).catch(() => {});
    }
    throw error;
  }
};

export const uploadPaymentDoc = async (paymentId: string, documentType: string, fileInfo: any, userId: string) => {
  let createdStorageKey: string | null = null;
  try {
    return await withTransaction(async (client) => {
      const pRes = await client.query('SELECT id FROM payments WHERE id = $1', [paymentId]);
      if (pRes.rowCount === 0) {
        throw new AppError('NOT_FOUND', 'Payment not found', 404);
      }

      const originalName = fileInfo.name || `${documentType.toLowerCase()}.pdf`;
      const storageKey = saveMockPhysicalFile(originalName);
      createdStorageKey = storageKey;

      const sql = `
        INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by)
        VALUES ($1, $2, 'LOCAL', $3, $4, $5, $6) RETURNING *
      `;
      const res = await client.query(sql, [documentType, originalName, storageKey, fileInfo.mime, fileInfo.size, userId]);
      const doc = res.rows[0];

      await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'PAYMENT', $2)`, [doc.id, paymentId]);
      await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD_PAYMENT', newState: doc, userId }, client);
      
      return doc;
    });
  } catch (error) {
    if (createdStorageKey) {
      await storageService.delete(createdStorageKey).catch(() => {});
    }
    throw error;
  }
};



