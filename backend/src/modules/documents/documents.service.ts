
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

export const listDocuments = async (tripId?: string) => {
  let sql = `
    SELECT d.id, d.document_type, d.original_name, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at,
           dl.entity_type, dl.entity_id
    FROM documents d
    LEFT JOIN document_links dl ON dl.document_id = d.id
    WHERE d.is_deleted = false
  `;
  const params: any[] = [];
  if (tripId) {
    sql += ` AND dl.entity_type = 'TRIP' AND dl.entity_id = $1`;
    params.push(tripId);
  }
  sql += ` ORDER BY d.uploaded_at DESC`;

  const res = await query(sql, params);
  return res.rows;
};

export const getDocumentMetadata = async (id: string) => {
  const sql = `
    SELECT d.id, d.document_type, d.original_name, d.storage_provider, d.storage_key, d.mime_type, d.file_size_bytes, d.uploaded_by, d.uploaded_at,
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

