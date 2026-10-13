import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let staffToken: string;
let caToken: string;

let partyId: string;
let tripId1: string;
let tripId2: string;
let tripId3: string;
let fyId: string;
let numberingSeriesId: string;
let billId: string;

beforeAll(async () => {
  await pool.query(
    'TRUNCATE users, parties, trips, bills, bill_items, bill_versions, bill_version_items, bill_numbering_series, financial_years, market_vehicles, vehicle_owners, payments, payment_allocations CASCADE'
  );

  const ownerId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  const staffId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff', 'STAFF', '9999999992', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  const caId = (
    await pool.query(
      "INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Chartered Accountant', 'CA', '9999999993', $1, true) RETURNING id",
      [await hashPassword('pass')]
    )
  ).rows[0].id;

  const jwt = require('jsonwebtoken');
  const secret = require('../src/config').config.jwt.secret;
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, secret, { expiresIn: '1d' });
  staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, secret, { expiresIn: '1d' });
  caToken = jwt.sign({ id: caId, role: 'CA' }, secret, { expiresIn: '1d' });

  fyId = (
    await pool.query(
      "INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('FY26', '2026-04-01', '2027-03-31', true) RETURNING id"
    )
  ).rows[0].id;

  partyId = (
    await pool.query(
      "INSERT INTO parties (name, primary_mobile, party_type, gstin, full_address, city, state, pin_code, is_active) VALUES ('Test Logistics Party', '9999999999', 'MARKET_PARTY', '27AABCS1429B1Z', '123 Warehouse Rd', 'Mumbai', 'Maharashtra', '400001', true) RETURNING id"
    )
  ).rows[0].id;

  numberingSeriesId = (
    await pool.query(
      "INSERT INTO bill_numbering_series (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by) VALUES ($1, $2, 'SER1', 'SRL-INV-', 0, true, $3) RETURNING id",
      [partyId, fyId, ownerId]
    )
  ).rows[0].id;

  const voId = (
    await pool.query("INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Test VO', '8888888888') RETURNING id")
  ).rows[0].id;

  const mvId = (
    await pool.query(
      "INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active) VALUES ('MH12AB1234', $1, true) RETURNING id",
      [voId]
    )
  ).rows[0].id;

  tripId1 = (
    await pool.query(
      "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-001', $1, 'MARKET', 'MARKET', $2, 'Mumbai', 'Pune', 'COMPLETED', '2026-10-01', $3) RETURNING id",
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  tripId2 = (
    await pool.query(
      "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-002', $1, 'MARKET', 'MARKET', $2, 'Pune', 'Nagpur', 'COMPLETED', '2026-10-02', $3) RETURNING id",
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  tripId3 = (
    await pool.query(
      "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-003', $1, 'MARKET', 'MARKET', $2, 'Nagpur', 'Nashik', 'COMPLETED', '2026-10-03', $3) RETURNING id",
      [partyId, mvId, ownerId]
    )
  ).rows[0].id;

  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId1]);
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId2]);
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId3]);

  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 15000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount',
    [tripId1]
  );
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 20000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount',
    [tripId2]
  );
  await pool.query(
    'INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 25000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount',
    [tripId3]
  );
});

afterAll(async () => {
  await pool.end();
});

describe('Billing Backend Contract Completion (Phase 3N)', () => {
  describe('1. Discovery Endpoints', () => {
    it('should list financial years', async () => {
      const res = await request(app).get('/api/financial-years').set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].code).toBe('FY26');
    });

    it('should list numbering series for bills and parties', async () => {
      const res = await request(app)
        .get(`/api/bills/numbering-series?party_id=${partyId}&financial_year_id=${fyId}`)
        .set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].prefix).toBe('SRL-INV-');
      expect(res.body.data[0].party_name).toBe('Test Logistics Party');

      const partyRes = await request(app)
        .get(`/api/parties/${partyId}/numbering-series`)
        .set('Authorization', 'Bearer ' + caToken);
      expect(partyRes.status).toBe(200);
      expect(partyRes.body.data[0].prefix).toBe('SRL-INV-');
    });

    it('should discover eligible unbilled trips for a party', async () => {
      const res = await request(app)
        .get(`/api/bills/eligible-trips?party_id=${partyId}`)
        .set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(3);
      expect(res.body.data[0]).toHaveProperty('trip_number');
      expect(res.body.data[0]).toHaveProperty('vehicle_number');
      expect(res.body.data[0]).toHaveProperty('receivable_amount');
    });

    it('should require party_id in eligible-trips endpoint', async () => {
      const res = await request(app).get('/api/bills/eligible-trips').set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(400);
    });
  });

  describe('2. Bill Generation and Eligibility', () => {
    it('should check eligibility with post payload', async () => {
      const res = await request(app)
        .post('/api/bills/eligibility')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          trip_ids: [tripId1, tripId2]
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].is_eligible).toBe(true);
    });

    it('should generate a consolidated bill for trips 1 and 2', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fyId,
          numbering_series_id: numberingSeriesId,
          billing_mode: 'CONSOLIDATED',
          bill_date: '2026-10-04',
          trip_ids: [tripId1, tripId2],
          template_snapshot: {}
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bill.bill_number).toBe('SRL-INV-1');
      expect(res.body.data.bill.total_amount).toBe('35000.00');
      expect(res.body.data.bill.balance_amount).toBe('35000.00');

      billId = res.body.data.bill.id;
    });

    it('billed trips should no longer appear in eligible unbilled trips', async () => {
      const res = await request(app)
        .get(`/api/bills/eligible-trips?party_id=${partyId}`)
        .set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(tripId3);
    });
  });

  describe('3. Role Authorization (RBAC)', () => {
    it('CA role can read bills list', async () => {
      const res = await request(app).get('/api/bills').set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('CA role can read bill details', async () => {
      const res = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(billId);
    });

    it('CA role is forbidden from generating a bill', async () => {
      const res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + caToken)
        .send({
          party_id: partyId,
          financial_year_id: fyId,
          numbering_series_id: numberingSeriesId,
          billing_mode: 'INDIVIDUAL',
          bill_date: '2026-10-05',
          trip_ids: [tripId3],
          template_snapshot: {}
        });
      expect(res.status).toBe(403);
    });

    it('CA role is forbidden from submitting a bill', async () => {
      const res = await request(app).post(`/api/bills/${billId}/submit`).set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(403);
    });

    it('CA role is forbidden from cancelling a bill', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + caToken)
        .send({ cancel_reason: 'Testing CA rejection' });
      expect(res.status).toBe(403);
    });

    it('CA role is forbidden from creating bill versions', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + caToken)
        .send({ template_snapshot: {} });
      expect(res.status).toBe(403);
    });
  });

  describe('4. List API (Search, Filters, and Pagination)', () => {
    it('supports pagination structure', async () => {
      const res = await request(app).get('/api/bills?page=1&limit=10').set('Authorization', 'Bearer ' + ownerToken);
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.total).toBe(1);
      expect(res.body.pagination.totalPages).toBe(1);
    });

    it('supports search by bill number and party name', async () => {
      const res = await request(app).get('/api/bills?search=SRL-INV').set('Authorization', 'Bearer ' + ownerToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].bill_number).toBe('SRL-INV-1');

      const nonExistent = await request(app).get('/api/bills?search=NONEXISTENT').set('Authorization', 'Bearer ' + ownerToken);
      expect(nonExistent.status).toBe(200);
      expect(nonExistent.body.data.length).toBe(0);
    });

    it('supports filtering by status and dates', async () => {
      const statusRes = await request(app)
        .get('/api/bills?bill_status=GENERATED')
        .set('Authorization', 'Bearer ' + ownerToken);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.length).toBe(1);

      const dateRes = await request(app)
        .get('/api/bills?from_date=2026-10-01&to_date=2026-10-10')
        .set('Authorization', 'Bearer ' + ownerToken);
      expect(dateRes.status).toBe(200);
      expect(dateRes.body.data.length).toBe(1);
    });

    it('projects required summary fields', async () => {
      const res = await request(app).get('/api/bills').set('Authorization', 'Bearer ' + ownerToken);
      const row = res.body.data[0];
      expect(row.party_name).toBe('Test Logistics Party');
      expect(row.financial_year_code).toBe('FY26');
      expect(row.current_version).toBe(1);
      expect(Number(row.total_amount)).toBe(35000);
      expect(Number(row.balance_amount)).toBe(35000);
      expect(Number(row.paid_amount)).toBe(0);
    });
  });

  describe('5. Detail API Completeness', () => {
    it('returns party details, financial year details, trip items, versions, and allocations', async () => {
      const res = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + ownerToken);
      expect(res.status).toBe(200);
      const data = res.body.data;

      // Party Details
      expect(data.party).toBeDefined();
      expect(data.party.name).toBe('Test Logistics Party');
      expect(data.party.gstin).toBe('27AABCS1429B1Z');
      expect(data.party.city).toBe('Mumbai');

      // Financial Year Details
      expect(data.financial_year).toBeDefined();
      expect(data.financial_year.code).toBe('FY26');

      // Creator
      expect(data.creator).toBeDefined();
      expect(data.creator.name).toBe('Staff');

      // Items with operational fields
      expect(data.items.length).toBe(2);
      expect(data.items[0].trip_number).toBe('TRP-001');
      expect(data.items[0].vehicle_number).toBe('MH12AB1234');
      expect(data.items[0].route_origin).toBe('Mumbai');
      expect(data.items[0].route_destination).toBe('Pune');

      // Version items
      expect(data.versions.length).toBe(1);
      expect(data.versions[0].items.length).toBe(2);

      // Allocations
      expect(Array.isArray(data.allocations)).toBe(true);
    });
  });

  describe('6. Bill Submission, Versioning, and Correction Integrity', () => {
    it('submits a generated bill', async () => {
      const res = await request(app).post(`/api/bills/${billId}/submit`).set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(200);
      expect(res.body.data.bill_status).toBe('SUBMITTED');
    });

    it('creates Version 2 with modified line amounts under the same bill number', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          template_snapshot: { layout: { theme: 'modern' } },
          items: [
            {
              trip_id: tripId1,
              sequence_no: 1,
              description: 'Revised freight for Trip TRP-001',
              line_amount: 20000
            },
            {
              trip_id: tripId2,
              sequence_no: 2,
              description: 'Revised freight for Trip TRP-002',
              line_amount: 22000
            }
          ]
        });
      expect(res.status).toBe(201);
      expect(res.body.data.version_number).toBe(2);
      expect(res.body.data.version_status).toBe('ACTIVE');

      const detailRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + ownerToken);
      expect(detailRes.body.data.versions.length).toBe(2);
      expect(detailRes.body.data.current_version).toBe(2);
      expect(Number(detailRes.body.data.total_amount)).toBe(42000);
      expect(Number(detailRes.body.data.balance_amount)).toBe(42000);
      expect(detailRes.body.data.items[0].line_amount).toBe('20000.00');
      expect(detailRes.body.data.items[1].line_amount).toBe('22000.00');
    });

    it('preserves historical Version 1 snapshot and its items completely immutable', async () => {
      const res = await request(app)
        .get(`/api/bills/${billId}/versions/1`)
        .set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.body.data.version_number).toBe(1);
      expect(res.body.data.version_status).toBe('SUPERSEDED');
      expect(res.body.data.items.length).toBe(2);
      expect(Number(res.body.data.items[0].line_amount)).toBe(15000);
      expect(Number(res.body.data.items[1].line_amount)).toBe(20000);

      // Verify DB trigger bill_version_items_append_only prevents mutation of historical version items
      const v1Id = res.body.data.id;
      await expect(
        pool.query('UPDATE bill_version_items SET line_amount = 99999 WHERE bill_version_id = $1', [v1Id])
      ).rejects.toThrow(/append-only/i);

      // Verify DB trigger guard_bill_version_snapshot prevents modifying version snapshot fields
      await expect(
        pool.query("UPDATE bill_versions SET template_snapshot = '{\"mutated\": true}'::jsonb WHERE id = $1", [v1Id])
      ).rejects.toThrow(/immutable/i);
    });

    it('rejects version creation with duplicate sequence numbers (400)', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [
            { trip_id: tripId1, sequence_no: 1, description: 'Line 1', line_amount: 10000 },
            { trip_id: tripId2, sequence_no: 1, description: 'Line 2 duplicate seq', line_amount: 10000 }
          ]
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects version creation with an un-received POD or non-completed trip (422)', async () => {
      // Create a pending trip
      const pendingTripId = (
        await pool.query(
          "INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, origin, destination, status, trip_date, created_by) VALUES ('TRP-PENDING', $1, 'MARKET', 'MARKET', (SELECT id FROM market_vehicles LIMIT 1), 'CityA', 'CityB', 'IN_TRANSIT', '2026-10-05', (SELECT id FROM users WHERE role='OWNER' LIMIT 1)) RETURNING id",
          [partyId]
        )
      ).rows[0].id;

      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [
            { trip_id: pendingTripId, sequence_no: 1, description: 'Pending trip freight', line_amount: 10000 }
          ]
        });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('rejects version creation with trip already billed in another active bill (422)', async () => {
      // Generate a second bill for tripId3
      const bill2Res = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fyId,
          numbering_series_id: numberingSeriesId,
          billing_mode: 'INDIVIDUAL',
          bill_date: '2026-10-06',
          trip_ids: [tripId3],
          template_snapshot: {}
        });
      expect(bill2Res.status).toBe(201);

      // Now attempt to add tripId3 to billId
      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [
            { trip_id: tripId1, sequence_no: 1, description: 'Trip 1', line_amount: 20000 },
            { trip_id: tripId3, sequence_no: 2, description: 'Trip 3 conflict', line_amount: 25000 }
          ]
        });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(res.body.error.message).toContain('already billed in active bill');
    });

    it('returns 404 for non-existent version', async () => {
      const res = await request(app)
        .get(`/api/bills/${billId}/versions/999`)
        .set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(404);
    });
  });

  describe('7. PDF Generation, Version Isolation, and Multi-Page Document Streaming', () => {
    it('streams Version 1 historical PDF matching Version 1 totals', async () => {
      const res = await request(app).get(`/api/bills/${billId}/versions/1/pdf`).set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('Bill-SRL-INV-1-v1.pdf');

      const bodyStr = res.body.toString('latin1');
      expect(bodyStr.startsWith('%PDF-1.4')).toBe(true);
      expect(bodyStr).toMatch(/Total Amount:\s+INR (35,000\.00|35000\.00)/);
    });

    it('streams current active Version 2 PDF matching corrected totals', async () => {
      const res = await request(app).get(`/api/bills/${billId}/pdf`).set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('Bill-SRL-INV-1-v2.pdf');

      const bodyStr = res.body.toString('latin1');
      expect(bodyStr.startsWith('%PDF-1.4')).toBe(true);
      expect(bodyStr).toMatch(/Total Amount:\s+INR (42,000\.00|42000\.00)/);
    });

    it('generates and streams a multi-page PDF document with continuation headers and page numbers', async () => {
      // Create a version with 25 line items to force pagination (20 items on page 1, 5 on page 2)
      const items25 = Array.from({ length: 25 }, (_, i) => ({
        trip_id: null,
        sequence_no: i + 1,
        description: `Consolidated freight charge line ${i + 1}`,
        line_amount: 1000
      }));

      const v3Res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          template_snapshot: { layout: { theme: 'multi-page-test' } },
          items: items25
        });
      expect(v3Res.status).toBe(201);
      expect(v3Res.body.data.version_number).toBe(3);

      const pdfRes = await request(app).get(`/api/bills/${billId}/pdf`).set('Authorization', 'Bearer ' + ownerToken);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toBe('application/pdf');
      expect(pdfRes.headers['content-disposition']).toContain('Bill-SRL-INV-1-v3.pdf');

      const pdfStr = pdfRes.body.toString('latin1');
      expect(pdfStr.startsWith('%PDF-1.4')).toBe(true);
      expect(pdfStr).toContain('/Count 2'); // 2 pages in Pages object
      expect(pdfStr).toContain('Page 1 of 2');
      expect(pdfStr).toContain('Page 2 of 2');
      expect(pdfStr).toContain('[Page 2 of 2]'); // Continuation header on page 2
      expect(pdfStr).toMatch(/Total Amount:\s+INR (25,000\.00|25000\.00)/);
    });
  });

  describe('8. Safe Cancellation, Allocation Underflow Protection, and Numbering Isolation', () => {
    let paymentId: string;
    let allocationId: string;

    it('rejects version correction if new total is less than active payment allocations (422)', async () => {
      // Allocate 20,000 to the bill inside a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const pRes = await client.query(
          "INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-ALLOC-CHECK', 'INCOMING', 'MARKET_PARTY_PAYMENT', $1, '2026-10-07', 20000, 'BANK_TRANSFER', 'ACTIVE', (SELECT id FROM users WHERE role='OWNER' LIMIT 1)) RETURNING id",
          [partyId]
        );
        paymentId = pRes.rows[0].id;

        const aRes = await client.query(
          "INSERT INTO payment_allocations (payment_id, bill_id, allocation_type, allocation_amount, allocation_status, created_by) VALUES ($1, $2, 'BILL', 20000, 'ACTIVE', (SELECT id FROM users WHERE role='OWNER' LIMIT 1)) RETURNING id",
          [paymentId, billId]
        );
        allocationId = aRes.rows[0].id;
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      // Now attempt correction to 15,000 (less than active allocations of 20,000)
      const underflowAttempt = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          items: [
            { sequence_no: 1, description: 'Reduced line amount below allocation', line_amount: 15000 }
          ]
        });

      expect(underflowAttempt.status).toBe(422);
      expect(underflowAttempt.body.error.code).toBe('BILLING_VIOLATION');
      expect(underflowAttempt.body.error.message).toContain('cannot be less than active payment allocations');
    });

    it('prevents cancellation when bill has active payment allocations (422)', async () => {
      const cancelAttempt = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Cancellation attempt with active payment' });

      expect(cancelAttempt.status).toBe(422);
      expect(cancelAttempt.body.error.code).toBe('BILL_HAS_ACTIVE_ALLOCATIONS');
    });

    it('rejects cancellation when reason is missing or less than 5 characters (400)', async () => {
      const cancelAttempt = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'no' });

      expect(cancelAttempt.status).toBe(400);
      expect(cancelAttempt.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('allows cancellation once payment allocations are reversed, releasing trips back to unbilled', async () => {
      // Reverse payment via payments API
      const revRes = await request(app)
        .post(`/api/payments/${paymentId}/reverse`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ reversal_reason: 'Testing payment reversal' });
      expect(revRes.status).toBe(200);

      // Now cancellation must succeed
      const cancelRes = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Bill cancelled after payment reversal' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.bill_status).toBe('CANCELLED');
      expect(cancelRes.body.data.cancel_reason).toBe('Bill cancelled after payment reversal');

      // The linked trips should immediately return to eligible unbilled trips!
      const eligibleRes = await request(app)
        .get(`/api/bills/eligible-trips?party_id=${partyId}`)
        .set('Authorization', 'Bearer ' + staffToken);

      expect(eligibleRes.status).toBe(200);
      const eligibleTripNumbers = eligibleRes.body.data.map((t: any) => t.trip_number);
      expect(eligibleTripNumbers).toContain('TRP-001');
      expect(eligibleTripNumbers).toContain('TRP-002');
    });

    it('rejects re-cancelling or adding versions to an already cancelled bill (422)', async () => {
      const reCancel = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Attempting re-cancel' });
      expect(reCancel.status).toBe(422);

      const addVersion = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({ template_snapshot: {} });
      expect(addVersion.status).toBe(422);
    });

    it('ensures cancelled bill numbers are never reused and subsequent bill generation gets next number in series', async () => {
      // Bill 1 was SRL-INV-1, Bill 2 was SRL-INV-2 (generated earlier in trip3 test).
      // Now generating a new bill for trip 1 must generate SRL-INV-3!
      const newBillRes = await request(app)
        .post('/api/bills')
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          party_id: partyId,
          financial_year_id: fyId,
          numbering_series_id: numberingSeriesId,
          billing_mode: 'INDIVIDUAL',
          bill_date: '2026-10-08',
          trip_ids: [tripId1],
          template_snapshot: {}
        });

      expect(newBillRes.status).toBe(201);
      expect(newBillRes.body.data.bill.bill_number).toBe('SRL-INV-3');
    });
  });
});
