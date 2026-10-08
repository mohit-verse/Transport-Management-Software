
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';

export const uploadPOD = async (tripId: string, fileInfo: any, userId: string) => {
  return withTransaction(async (client) => {
    // Basic doc insert
    const sql = `
      INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by)
      VALUES ('POD', $1, 'LOCAL', 'mock_pod.pdf', $2, $3, $4) RETURNING *
    `;
    const res = await client.query(sql, [fileInfo.name, fileInfo.mime, fileInfo.size, userId]);
    const doc = res.rows[0];

    // Link
    await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'TRIP', $2)`, [doc.id, tripId]);

    // Update trip POD status
    await client.query(`UPDATE trip_pods SET pod_status = 'RECEIVED', pod_received_at = NOW(), updated_at = NOW() WHERE trip_id = $1`, [tripId]);

    await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD', newState: doc, userId }, client);
    return doc;
  });
};

export const listDocuments = async (entityType?: string, entityId?: string) => {
  let sql = `
    SELECT d.id, d.document_type, d.original_name, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at, d.expiry_date,
           dl.entity_type, dl.entity_id
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id
    WHERE d.is_deleted = false
  `;
  const params: any[] = [];
  if (entityType && entityId) {
    sql += ` AND dl.entity_type = $1 AND dl.entity_id = $2`;
    params.push(entityType, entityId);
  }
  sql += ` ORDER BY d.uploaded_at DESC`;

  const res = await query(sql, params);
  return res.rows;
};

export const getDocumentMetadata = async (id: string) => {
  const sql = `
    SELECT d.id, d.document_type, d.original_name, d.storage_provider, d.storage_key, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at, d.expiry_date,
           dl.entity_type, dl.entity_id
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id
    WHERE d.id = $1 AND d.is_deleted = false
  `;
  const res = await query(sql, [id]);
  if (res.rowCount === 0) {
    throw new AppError('NOT_FOUND', 'Document not found', 404);
  }
  return res.rows[0];
};

export const uploadOwnFleetDoc = async (vehicleId: string, documentType: string, expiryDate: string | undefined, fileInfo: any, userId: string, role: string) => {
  return withTransaction(async (client) => {
    const existingRes = await client.query(`
      SELECT d.id FROM documents d
      JOIN document_links dl ON dl.document_id = d.id
      WHERE dl.entity_type = 'OWN_FLEET_VEHICLE' AND dl.entity_id = $1 AND d.document_type = $2 AND d.is_deleted = false
    `, [vehicleId, documentType]);
    
    if (existingRes.rowCount && existingRes.rowCount > 0) {
      if (role !== 'OWNER') {
        throw new AppError('FORBIDDEN', 'Only OWNER can replace existing documents', 403);
      }
      await client.query(`UPDATE documents SET is_deleted = true WHERE id = $1`, [existingRes.rows[0].id]);
    }

    const sql = `
      INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by, expiry_date)
      VALUES ($1, $2, 'LOCAL', 'mock_doc.pdf', $3, $4, $5, $6) RETURNING *
    `;
    const res = await client.query(sql, [documentType, fileInfo.name, fileInfo.mime, fileInfo.size, userId, expiryDate || null]);
    const doc = res.rows[0];

    await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'OWN_FLEET_VEHICLE', $2)`, [doc.id, vehicleId]);
    await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD_OWN_FLEET', newState: doc, userId }, client);
    
    return doc;
  });
};

