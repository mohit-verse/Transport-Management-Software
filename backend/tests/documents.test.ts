import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import fs from 'fs';
import path from 'path';

describe('Documents & Storage API (Phase 4N)', () => {
  let ownerToken: string;
  let staffToken: string;
  let caToken: string;
  let ownerId: string;
  let staffId: string;
  let tripId: string;
  let vehicleId: string;
  let partyId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Truncate tables for isolated test run
    await pool.query('TRUNCATE users, parties, trips, own_fleet_vehicles, payments, payment_allocations, party_credits, documents, document_links, audit_events CASCADE');

    // Create users with distinct roles
    ownerId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner User', 'OWNER', '9888888881', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    staffId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff User', 'STAFF', '9888888882', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    const caId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA User', 'CA', '9888888883', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, config.jwt.secret, { expiresIn: '1d' });
    staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, config.jwt.secret, { expiresIn: '1d' });
    caToken = jwt.sign({ id: caId, role: 'CA' }, config.jwt.secret, { expiresIn: '1d' });

    // Seed master records
    partyId = (await pool.query(
      `INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Ambuja Cements', '9111111111') RETURNING id`
    )).rows[0].id;

    vehicleId = (await pool.query(
      `INSERT INTO own_fleet_vehicles (vehicle_number) VALUES ('RJ14GA9999') RETURNING id`
    )).rows[0].id;

    tripId = (await pool.query(
      `INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by)
       VALUES ('TRIP-DOC-001', 'COMPANY', 'OWN_FLEET', $1, $2, NOW(), 'CREATED', $3) RETURNING id`,
      [partyId, vehicleId, ownerId]
    )).rows[0].id;

    await pool.query('BEGIN');
    paymentId = (await pool.query(
      `INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by)
       VALUES ('PAY-DOC-001', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-01', 50000.00, 'BANK_TRANSFER', 'ACTIVE', $2) RETURNING id`,
      [partyId, ownerId]
    )).rows[0].id;

    await pool.query(
      `INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, allocation_status, created_by)
       VALUES ($1, 'TRIP', 50000.00, $2, 'ACTIVE', $3)`,
      [paymentId, tripId, ownerId]
    );
    await pool.query('COMMIT');

    // Ensure mock storage files exist
    const storageDir = path.join(__dirname, '../../storage/development');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(path.join(storageDir, 'mock_doc.pdf'), '%PDF-1.4 Mock document for testing');
    fs.writeFileSync(path.join(storageDir, 'mock_pod.pdf'), '%PDF-1.4 Mock POD for testing');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Document Uploads & RBAC', () => {
    it('allows STAFF to upload a generic document linked to a Trip', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'LR_COPY',
          file_name: 'lr_1001.pdf',
          file_size_bytes: 2048
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.document_type).toBe('LR_COPY');
      expect(res.body.data.original_name).toBe('lr_1001.pdf');
    });

    it('allows OWNER to upload an Own Fleet compliance document with expiry date', async () => {
      // Expiry 20 days in the future (Expiring Soon)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 20);
      const expiryStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'OWN_FLEET_VEHICLE',
          entity_id: vehicleId,
          document_type: 'INSURANCE',
          expiry_date: expiryStr,
          file_name: 'rj14_insurance.pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('INSURANCE');
      expect(res.body.data.expiry_date).toBeDefined();
    });

    it('allows uploading an expired compliance document', async () => {
      // Past date (Expired)
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const expiryStr = pastDate.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'OWN_FLEET_VEHICLE',
          entity_id: vehicleId,
          document_type: 'FITNESS',
          expiry_date: expiryStr,
          file_name: 'fitness_old.pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('FITNESS');
    });

    it('allows uploading a Payment receipt', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          entity_type: 'PAYMENT',
          entity_id: paymentId,
          document_type: 'PAYMENT_RECEIPT',
          file_name: 'bank_slip.pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('PAYMENT_RECEIPT');
    });

    it('rejects upload when associated entity does not exist (404)', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: randomUuid,
          document_type: 'WEIGHT_SLIP'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('not found');
    });

    it('prohibits CA from uploading documents (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${caToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'TAX_INVOICE'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Document Listing, Search & Filters', () => {
    it('lists all documents with joined entity references and uploader names', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      // Verify enriched fields
      const tripDoc = res.body.data.find((d: any) => d.document_type === 'LR_COPY');
      expect(tripDoc).toBeDefined();
      expect(tripDoc.entity_type).toBe('TRIP');
      expect(tripDoc.entity_reference).toBe('TRIP-DOC-001');
      expect(tripDoc.uploaded_by_name).toBe('Staff User');

      const vehicleDoc = res.body.data.find((d: any) => d.document_type === 'INSURANCE');
      expect(vehicleDoc).toBeDefined();
      expect(vehicleDoc.entity_type).toBe('OWN_FLEET_VEHICLE');
      expect(vehicleDoc.entity_reference).toBe('RJ14GA9999');
    });

    it('filters documents by document_type', async () => {
      const res = await request(app)
        .get('/api/documents?document_type=INSURANCE')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((d: any) => d.document_type === 'INSURANCE')).toBe(true);
    });

    it('filters documents by entity_type', async () => {
      const res = await request(app)
        .get('/api/documents?entity_type=PAYMENT')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].entity_reference).toBe('PAY-DOC-001');
    });

    it('filters documents by expiry_status: EXPIRED', async () => {
      const res = await request(app)
        .get('/api/documents?expiry_status=EXPIRED')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.some((d: any) => d.document_type === 'FITNESS')).toBe(true);
    });

    it('filters documents by expiry_status: EXPIRING_SOON', async () => {
      const res = await request(app)
        .get('/api/documents?expiry_status=EXPIRING_SOON')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((d: any) => d.document_type === 'INSURANCE')).toBe(true);
    });

    it('searches documents by query string across name and entity reference', async () => {
      const res = await request(app)
        .get('/api/documents?search=RJ14GA9999')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every((d: any) => d.entity_reference === 'RJ14GA9999')).toBe(true);
    });

    it('allows CA to list documents (read-only verification)', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Document Metadata & Secure File Stream', () => {
    let testDocId: string;

    beforeAll(async () => {
      const docs = (await pool.query(`SELECT id FROM documents WHERE is_deleted = false LIMIT 1`)).rows;
      testDocId = docs[0].id;
    });

    it('returns document metadata without exposing storage_key or storage_provider', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testDocId);
      expect(res.body.data.original_name).toBeDefined();
      expect(res.body.data.storage_key).toBeUndefined();
      expect(res.body.data.storage_provider).toBeUndefined();
    });

    it('streams file securely with Content-Type and Content-Disposition', async () => {
      const res = await request(app)
        .get(`/api/documents/${testDocId}/file`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text || res.body.toString()).toContain('%PDF-1.4');
    });

    it('returns clean 404 AppError when physical file is missing without path leakage', async () => {
      // Insert document pointing to non-existent storage key
      const phantomDoc = (await pool.query(
        `INSERT INTO documents (document_type, original_name, storage_provider, storage_key, uploaded_by)
         VALUES ('OTHER', 'ghost.pdf', 'LOCAL', 'non_existent_ghost_file.pdf', $1) RETURNING id`,
        [ownerId]
      )).rows[0];

      const res = await request(app)
        .get(`/api/documents/${phantomDoc.id}/file`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe('Requested document file is unavailable in storage.');
      expect(res.text).not.toContain('storage/development');
      expect(res.text).not.toContain('D:\\');
    });
  });

  describe('Document Replacement & Deletion (Owner Authority)', () => {
    let replaceableDocId: string;

    beforeEach(async () => {
      const randKey = `documents/test_permit_${Date.now()}_${Math.random()}.pdf`;
      const doc = (await pool.query(
        `INSERT INTO documents (document_type, original_name, storage_provider, storage_key, uploaded_by)
         VALUES ('PERMIT', 'permit_v1.pdf', 'LOCAL', $1, $2) RETURNING id`,
        [randKey, ownerId]
      )).rows[0];

      await pool.query(
        `INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'OWN_FLEET_VEHICLE', $2)`,
        [doc.id, vehicleId]
      );

      replaceableDocId = doc.id;
    });

    it('prohibits STAFF and CA from replacing a document (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .post(`/api/documents/${replaceableDocId}/replace`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ file_name: 'permit_v2.pdf', reason: 'Annual renewal' });

      expect(staffRes.status).toBe(403);

      const caRes = await request(app)
        .post(`/api/documents/${replaceableDocId}/replace`)
        .set('Authorization', `Bearer ${caToken}`)
        .send({ file_name: 'permit_v2.pdf' });

      expect(caRes.status).toBe(403);
    });

    it('allows OWNER to replace document: archives old doc and creates active replacement', async () => {
      const res = await request(app)
        .post(`/api/documents/${replaceableDocId}/replace`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          file_name: 'permit_v2_renewed.pdf',
          expiry_date: '2028-12-31',
          reason: 'State permit renewed for 2 years'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).not.toBe(replaceableDocId);
      expect(res.body.data.original_name).toBe('permit_v2_renewed.pdf');

      // Verify old document is soft deleted in DB
      const oldCheck = await pool.query(`SELECT is_deleted, deleted_at FROM documents WHERE id = $1`, [replaceableDocId]);
      expect(oldCheck.rows[0].is_deleted).toBe(true);
      expect(oldCheck.rows[0].deleted_at).not.toBeNull();

      // Verify replacement is linked to the vehicle
      const linkCheck = await pool.query(
        `SELECT * FROM document_links WHERE document_id = $1 AND entity_id = $2`,
        [res.body.data.id, vehicleId]
      );
      expect(linkCheck.rows.length).toBe(1);

      // Verify audit event
      const auditCheck = await pool.query(
        `SELECT * FROM audit_events WHERE entity_id = $1 AND action_type = 'REPLACE'`,
        [res.body.data.id]
      );
      expect(auditCheck.rows.length).toBe(1);
    });

    it('prohibits STAFF and CA from deleting a document (403 Forbidden)', async () => {
      const staffRes = await request(app)
        .delete(`/api/documents/${replaceableDocId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'Accidental upload' });

      expect(staffRes.status).toBe(403);

      const caRes = await request(app)
        .delete(`/api/documents/${replaceableDocId}`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(caRes.status).toBe(403);
    });

    it('allows OWNER to delete document: soft deletes and preserves audit trail', async () => {
      const res = await request(app)
        .delete(`/api/documents/${replaceableDocId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Duplicate attachment removed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify document marked deleted
      const check = await pool.query(`SELECT is_deleted, deleted_at FROM documents WHERE id = $1`, [replaceableDocId]);
      expect(check.rows[0].is_deleted).toBe(true);
      expect(check.rows[0].deleted_at).not.toBeNull();

      // Verify audit event
      const audit = await pool.query(
        `SELECT * FROM audit_events WHERE entity_id = $1 AND action_type = 'DELETE'`,
        [replaceableDocId]
      );
      expect(audit.rows.length).toBe(1);
      expect(audit.rows[0].before_state.reason).toBe('Duplicate attachment removed');
    });
  });

  describe('File Validation Guardrails (Max Size, MIME, Path Traversal)', () => {
    it('rejects uploads exceeding 10MB limit (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'LR_COPY',
          file_name: 'huge_file.pdf',
          file_size_bytes: 11 * 1024 * 1024
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('10MB');
    });

    it('rejects filenames with path traversal sequences (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'LR_COPY',
          file_name: '../../secret.pdf'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('path traversal');
    });

    it('rejects filenames with null bytes (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'LR_COPY',
          file_name: 'test\0file.pdf'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects disallowed executable extensions (400 Bad Request)', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'LR_COPY',
          file_name: 'malicious_script.exe'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).toContain('File extension must be one of');
    });
  });

  describe('Role & Entity-Level Access Isolation (CA Role Restrictions)', () => {
    let ownFleetDocId: string;

    beforeAll(async () => {
      const doc = (await pool.query(
        `INSERT INTO documents (document_type, original_name, storage_provider, storage_key, uploaded_by)
         VALUES ('FITNESS', 'vehicle_fitness.pdf', 'LOCAL', 'documents/test_fitness.pdf', $1) RETURNING id`,
        [ownerId]
      )).rows[0];

      await pool.query(
        `INSERT INTO document_links (document_id, entity_type, entity_id) VALUES ($1, 'OWN_FLEET_VEHICLE', $2)`,
        [doc.id, vehicleId]
      );
      ownFleetDocId = doc.id;
    });

    it('forbids CA from accessing metadata of Own-Fleet documents by ID (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/documents/${ownFleetDocId}`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('CA role is not authorized');
    });

    it('forbids CA from downloading/streaming files of Own-Fleet documents (403 Forbidden)', async () => {
      const res = await request(app)
        .get(`/api/documents/${ownFleetDocId}/file`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('CA role is not authorized');
    });

    it('forbids CA from querying Own-Fleet documents via entity_type filter (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/documents?entity_type=OWN_FLEET_VEHICLE')
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('CA role is not authorized');
    });

    it('automatically excludes Own-Fleet and Market documents when CA lists documents', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const hasRestricted = res.body.data.some((d: any) =>
        ['OWN_FLEET_VEHICLE', 'OWN_FLEET', 'VEHICLE_OWNER', 'MARKET_VEHICLE'].includes(d.entity_type)
      );
      expect(hasRestricted).toBe(false);
    });
  });

  describe('Storage Integrity & Transactional Failure Cleanup', () => {
    it('cleans up physical file on disk when upload transaction fails', async () => {
      const storageDir = path.join(__dirname, '../../storage/development/documents');
      const filesBefore = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];

      const fakeUuid = '11111111-2222-3333-4444-555555555555';
      const res = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: fakeUuid,
          document_type: 'LR_COPY',
          file_name: 'rollback_test.pdf'
        });

      expect(res.status).toBe(404);

      const filesAfter = fs.existsSync(storageDir) ? fs.readdirSync(storageDir) : [];
      expect(filesAfter.length).toBe(filesBefore.length);
    });

    it('preserves historical physical files when document is replaced or deleted', async () => {
      // 1. Create a document with a mock file on disk
      const createRes = await request(app)
        .post('/api/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          entity_type: 'TRIP',
          entity_id: tripId,
          document_type: 'WEIGHT_SLIP',
          file_name: 'original_weight_slip.pdf'
        });

      expect(createRes.status).toBe(201);
      const originalDocId = createRes.body.data.id;

      // Query DB for storage_key
      const dbDoc = (await pool.query(`SELECT storage_key FROM documents WHERE id = $1`, [originalDocId])).rows[0];
      const filePath = path.join(__dirname, '../../storage/development', dbDoc.storage_key);
      expect(fs.existsSync(filePath)).toBe(true);

      // 2. Replace the document
      const replaceRes = await request(app)
        .post(`/api/documents/${originalDocId}/replace`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          file_name: 'replaced_weight_slip.pdf',
          reason: 'Corrected tare weight'
        });

      expect(replaceRes.status).toBe(200);

      // 3. Verify original physical file STILL exists on disk (NOT deleted)
      expect(fs.existsSync(filePath)).toBe(true);

      // 4. Delete replacement document
      const replacementId = replaceRes.body.data.id;
      const deleteRes = await request(app)
        .delete(`/api/documents/${replacementId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Audit cleanup' });

      expect(deleteRes.status).toBe(200);

      // Verify replacement physical file ALSO still exists on disk (NOT unlinked)
      const replDbDoc = (await pool.query(`SELECT storage_key FROM documents WHERE id = $1`, [replacementId])).rows[0];
      const replFilePath = path.join(__dirname, '../../storage/development', replDbDoc.storage_key);
      expect(fs.existsSync(replFilePath)).toBe(true);
    });
  });
});

