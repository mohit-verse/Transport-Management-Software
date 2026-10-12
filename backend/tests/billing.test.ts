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

  describe('6. Bill Submission and Versioning', () => {
    it('submits a generated bill', async () => {
      const res = await request(app).post(`/api/bills/${billId}/submit`).set('Authorization', 'Bearer ' + staffToken);
      expect(res.status).toBe(200);
      expect(res.body.data.bill_status).toBe('SUBMITTED');
    });

    it('creates Version 2 of the bill', async () => {
      const res = await request(app)
        .post(`/api/bills/${billId}/versions`)
        .set('Authorization', 'Bearer ' + staffToken)
        .send({
          template_snapshot: { layout: { theme: 'modern' } }
        });
      expect(res.status).toBe(201);
      expect(res.body.data.version_number).toBe(2);
      expect(res.body.data.version_status).toBe('ACTIVE');

      const detailRes = await request(app).get(`/api/bills/${billId}`).set('Authorization', 'Bearer ' + ownerToken);
      expect(detailRes.body.data.versions.length).toBe(2);
      expect(detailRes.body.data.current_version).toBe(2);
    });

    it('inspects historical Version 1 snapshot and its items', async () => {
      const res = await request(app)
        .get(`/api/bills/${billId}/versions/1`)
        .set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.body.data.version_number).toBe(1);
      expect(res.body.data.version_status).toBe('SUPERSEDED');
      expect(res.body.data.items.length).toBe(2);
    });

    it('returns 404 for non-existent version', async () => {
      const res = await request(app)
        .get(`/api/bills/${billId}/versions/999`)
        .set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(404);
    });
  });

  describe('7. PDF Generation and Retrieval', () => {
    it('generates and streams valid bill PDF for owner, staff, and CA', async () => {
      const res = await request(app).get(`/api/bills/${billId}/pdf`).set('Authorization', 'Bearer ' + caToken);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('Bill-SRL-INV-1.pdf');

      // Check PDF signature
      const isPdfHeader = res.body.slice(0, 4).toString() === '%PDF';
      expect(isPdfHeader).toBe(true);
    });
  });

  describe('8. Safe Cancellation and Allocation Protection', () => {
    let paymentId: string;
    let allocationId: string;

    it('prevents cancellation when bill has active payment allocations (422)', async () => {
      // Create payment and active allocation to the bill inside a single transaction so deferred constraint passes
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const pRes = await client.query(
          "INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-BILL-01', 'INCOMING', 'MARKET_PARTY_PAYMENT', $1, '2026-10-06', 10000, 'BANK_TRANSFER', 'ACTIVE', (SELECT id FROM users WHERE role='OWNER' LIMIT 1)) RETURNING id",
          [partyId]
        );
        paymentId = pRes.rows[0].id;

        const aRes = await client.query(
          "INSERT INTO payment_allocations (payment_id, bill_id, allocation_type, allocation_amount, allocation_status, created_by) VALUES ($1, $2, 'BILL', 10000, 'ACTIVE', (SELECT id FROM users WHERE role='OWNER' LIMIT 1)) RETURNING id",
          [paymentId, billId]
        );
        allocationId = aRes.rows[0].id;
        await client.query('COMMIT');
      } finally {
        client.release();
      }

      const cancelAttempt = await request(app)
        .post(`/api/bills/${billId}/cancel`)
        .set('Authorization', 'Bearer ' + ownerToken)
        .send({ cancel_reason: 'Cancellation attempt with active payment' });

      expect(cancelAttempt.status).toBe(422);
      expect(cancelAttempt.body.error.code).toBe('BILL_HAS_ACTIVE_ALLOCATIONS');
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
      expect(eligibleTripNumbers).toContain('TRP-003');
    });
  });
});
