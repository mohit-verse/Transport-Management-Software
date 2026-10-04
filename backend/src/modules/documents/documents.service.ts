
import { query } from '../../db';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../errors/AppError';
import { createAudit } from '../../utils/audit';

export const uploadPOD = async (tripId: string, fileInfo: any, userId: string) => {
  return withTransaction(async (client) => {
    // Basic doc insert
    const sql = `
      INSERT INTO documents (document_type, file_name, file_path, mime_type, size_bytes, uploaded_by)
      VALUES ('POD', $1, $2, $3, $4, $5) RETURNING *
    `;
    const res = await client.query(sql, [fileInfo.name, fileInfo.path, fileInfo.mime, fileInfo.size, userId]);
    const doc = res.rows[0];

    // Link
    await client.query(`INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'TRIP', $2)`, [doc.id, tripId]);

    // Update trip POD status
    await client.query(`UPDATE trip_pods SET pod_status = 'RECEIVED', pod_received_at = NOW(), updated_at = NOW() WHERE trip_id = $1`, [tripId]);

    await createAudit({ entityType: 'DOCUMENT', entityId: doc.id, action: 'UPLOAD', newState: doc, userId }, client);
    return doc;
  });
};
