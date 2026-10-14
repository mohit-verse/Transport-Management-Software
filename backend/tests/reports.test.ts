import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let caToken: string;
let partyId: string;
let fyId: string;
let tripIdA: string;

beforeAll(async () => {
  await pool.query('TRUNCATE users, parties, trips, own_fleet_vehicles, payments, payment_allocations, party_credits, financial_years CASCADE');
  
  const ownerId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const caId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA User', 'CA', '9999999992', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const jwt = require('jsonwebtoken'); 
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });
  caToken = jwt.sign({ id: caId, role: 'CA' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });

  partyId = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Party A', '1111111111') RETURNING id`)).rows[0].id;

  fyId = (await pool.query(`INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('2026-27', '2026-04-01', '2027-03-31', true) RETURNING id`)).rows[0].id;
  // We need an own fleet vehicle
  const ofvId = (await pool.query(`INSERT INTO own_fleet_vehicles (vehicle_number) VALUES ('MH12AB1234') RETURNING id`)).rows[0].id;
  tripIdA = (await pool.query(`INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by) VALUES ('TRIP-001', 'COMPANY', 'OWN_FLEET', $1, $2, NOW(), 'CREATED', $3) RETURNING id`, [partyId, ofvId, ownerId])).rows[0].id;

  const categoryId = (await pool.query(`INSERT INTO other_business_categories (category_type, category_name, created_by) VALUES ('PAYMENT', 'TEST_EXPENSE', $1) RETURNING id`, [ownerId])).rows[0].id;
  
  await pool.query('BEGIN');
  try {
    const pay1 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-001', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-01', 5000.00, 'BANK_TRANSFER', 'ACTIVE', $2) RETURNING id`, [partyId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, allocation_status, created_by) VALUES ($1, 'TRIP', 5000.00, $2, 'ACTIVE', $3)`, [pay1, tripIdA, ownerId]);
    
    const pay2 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-002', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-02', 2000.00, 'UPI', 'ACTIVE', $2) RETURNING id`, [partyId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, allocation_status, created_by) VALUES ($1, 'TRIP', 2000.00, $2, 'ACTIVE', $3)`, [pay2, tripIdA, ownerId]);

    const pay3 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, payment_date, amount, payment_mode, payment_status, other_business_category_id, created_by) VALUES ('PAY-003', 'OUTGOING', 'OTHER_BUSINESS_PAYMENT', '2026-06-03', 1000.00, 'CASH', 'ACTIVE', $1, $2) RETURNING id`, [categoryId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, allocation_status, created_by) VALUES ($1, 'OTHER_BUSINESS', 1000.00, 'ACTIVE', $2)`, [pay3, ownerId]);

    // Insert a REVERSED payment to test that reversed payments are strictly excluded from financial reports
    const payRev = (await pool.query(`
      INSERT INTO payments (
        payment_id, payment_type, category, party_id, payment_date, amount, payment_mode,
        payment_status, reversed_at, reversed_by, reversal_reason, created_by
      ) VALUES (
        'PAY-REV-001', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-04', 15000.00, 'BANK_TRANSFER',
        'REVERSED', NOW(), $2, 'Check bounced / reversed', $2
      ) RETURNING id
    `, [partyId, ownerId])).rows[0].id;
    await pool.query(`
      INSERT INTO payment_allocations (
        payment_id, allocation_type, allocation_amount, trip_id, allocation_status, reversed_at, created_by
      ) VALUES ($1, 'TRIP', 15000.00, $2, 'REVERSED', NOW(), $3)
    `, [payRev, tripIdA, ownerId]);

    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
});

afterAll(async () => {
  await pool.end();
});

describe('Phase 3E - Financial Reporting', () => {

  it('GET /api/reports/financial-summary should calculate PnL correctly', async () => {
    const res = await request(app)
      .get('/api/reports/financial-summary')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalIncoming).toBe(7000);
    expect(res.body.data.totalOutgoing).toBe(1000);
    expect(res.body.data.netPnl).toBe(6000);
  });

  it('GET /api/reports/pnl should group incoming and outgoing by category', async () => {
    const res = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.incomingByCategory.length).toBeGreaterThan(0);
    expect(res.body.data.outgoingByCategory.length).toBeGreaterThan(0);
  });

  it('GET /api/reports/incoming should list incoming payments', async () => {
    const res = await request(app)
      .get('/api/reports/incoming')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(2);
    expect(res.body.data.total).toBe(7000);
  });

  it('GET /api/reports/outgoing should list outgoing payments', async () => {
    const res = await request(app)
      .get('/api/reports/outgoing')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.total).toBe(1000);
  });

  it('GET /api/reports/payment-modes should aggregate by payment modes', async () => {
    const res = await request(app)
      .get('/api/reports/payment-modes')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3); // BANK_TRANSFER, UPI, CASH
  });

  it('GET /api/reports/credits should return credit generated and utilized', async () => {
    const res = await request(app)
      .get('/api/reports/credits')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.creditGenerated).toBe(0); // since we didn't insert any allocations
  });

  it('GET /api/reports/tds should list TDS amounts', async () => {
    const res = await request(app)
      .get('/api/reports/tds')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('GET /api/reports/bill-reconciliation should list bill reconciliation', async () => {
    const res = await request(app)
      .get('/api/reports/bill-reconciliation')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it('GET /api/reports/financial-year should return data restricted to that year', async () => {
    const res = await request(app)
      .get(`/api/reports/financial-year?financialYearId=${fyId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalIncoming).toBe(7000);
  });

  it('strictly excludes REVERSED payments from financial summary and totals', async () => {
    const res = await request(app)
      .get('/api/reports/financial-summary')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    // Active payments: 5000 (PAY-001) + 2000 (PAY-002) = 7000.
    // Reversed payment: 15000 (PAY-REV-001) MUST NOT BE INCLUDED.
    expect(res.body.data.totalIncoming).toBe(7000);
    expect(res.body.data.totalOutgoing).toBe(1000);
    expect(res.body.data.netPnl).toBe(6000);

    const incomingRes = await request(app)
      .get('/api/reports/incoming')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(incomingRes.status).toBe(200);
    expect(incomingRes.body.data.items.length).toBe(2);
    expect(incomingRes.body.data.total).toBe(7000);
    const hasReversed = incomingRes.body.data.items.some((item: any) => item.payment_status === 'REVERSED');
    expect(hasReversed).toBe(false);
  });

  it('allows CA role read-only access to all reporting endpoints', async () => {
    // 1. Financial summary
    const summaryRes = await request(app)
      .get('/api/reports/financial-summary')
      .set('Authorization', `Bearer ${caToken}`);
    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.data.netPnl).toBe(6000);

    // 2. PnL
    const pnlRes = await request(app)
      .get('/api/reports/pnl')
      .set('Authorization', `Bearer ${caToken}`);
    expect(pnlRes.status).toBe(200);

    // 3. Incoming
    const inRes = await request(app)
      .get('/api/reports/incoming')
      .set('Authorization', `Bearer ${caToken}`);
    expect(inRes.status).toBe(200);

    // 4. Outgoing
    const outRes = await request(app)
      .get('/api/reports/outgoing')
      .set('Authorization', `Bearer ${caToken}`);
    expect(outRes.status).toBe(200);

    // 5. Payment modes
    const modesRes = await request(app)
      .get('/api/reports/payment-modes')
      .set('Authorization', `Bearer ${caToken}`);
    expect(modesRes.status).toBe(200);

    // 6. Credits
    const credRes = await request(app)
      .get('/api/reports/credits')
      .set('Authorization', `Bearer ${caToken}`);
    expect(credRes.status).toBe(200);

    // 7. TDS
    const tdsRes = await request(app)
      .get('/api/reports/tds')
      .set('Authorization', `Bearer ${caToken}`);
    expect(tdsRes.status).toBe(200);

    // 8. Bill reconciliation
    const billReconRes = await request(app)
      .get('/api/reports/bill-reconciliation')
      .set('Authorization', `Bearer ${caToken}`);
    expect(billReconRes.status).toBe(200);

    // 9. Financial year
    const fyRes = await request(app)
      .get(`/api/reports/financial-year?financialYearId=${fyId}`)
      .set('Authorization', `Bearer ${caToken}`);
    expect(fyRes.status).toBe(200);
  });

  it('strictly forbids CA role from mutating business, payment, or operational records (403 Forbidden)', async () => {
    // Attempt payment creation by CA
    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        payment_type: 'INCOMING',
        category: 'COMPANY_PAYMENT',
        party_id: partyId,
        payment_date: '2026-06-10',
        amount: 1000,
        payment_mode: 'UPI',
        allocations: [{ allocation_type: 'CREDIT', allocated_amount: 1000 }]
      });
    expect(payRes.status).toBe(403);

    // Attempt bill creation by CA
    const billRes = await request(app)
      .post('/api/bills')
      .set('Authorization', `Bearer ${caToken}`)
      .send({
        party_id: partyId,
        financial_year_id: fyId,
        bill_date: '2026-06-10',
        billing_mode: 'INDIVIDUAL',
        trip_ids: [tripIdA]
      });
    expect(billRes.status).toBe(403);

    // Attempt trip edit by CA
    const tripRes = await request(app)
      .patch(`/api/trips/${tripIdA}`)
      .set('Authorization', `Bearer ${caToken}`)
      .send({ notes: 'Unauthorized edit' });
    expect(tripRes.status).toBe(403);

    // Attempt party billing config update by CA
    const configRes = await request(app)
      .patch(`/api/parties/${partyId}/billing-config`)
      .set('Authorization', `Bearer ${caToken}`)
      .send({ billing_mode: 'CONSOLIDATED' });
    expect(configRes.status).toBe(403);

    // Attempt numbering series create by CA
    const seriesRes = await request(app)
      .post('/api/numbering-series')
      .set('Authorization', `Bearer ${caToken}`)
      .send({ party_id: partyId, financial_year_id: fyId, series_code: 'TEST', prefix: 'T/' });
    expect(seriesRes.status).toBe(403);
  });

  it('correctly filters reports by date range', async () => {
    const res = await request(app)
      .get('/api/reports/incoming?fromDate=2026-06-02&toDate=2026-06-02')
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].payment_id).toBe('PAY-002');
    expect(res.body.data.total).toBe(2000);
  });

  describe('TDS and Bill Reconciliation reporting with period, party, and FY filters', () => {
    let partyIdB: string;
    let tripTds1: string;
    let tripTds2: string;
    let bill1: string;
    let bill2: string;

    beforeAll(async () => {
      const ownerRes = await pool.query("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1");
      const ownerId = ownerRes.rows[0].id;
      const ofvRes = await pool.query("SELECT id FROM own_fleet_vehicles LIMIT 1");
      const ofvId = ofvRes.rows[0].id;

      partyIdB = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Party B Corp', '2222222222') RETURNING id`)).rows[0].id;

      // Insert Trips with TDS
      tripTds1 = (await pool.query(`
        INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by)
        VALUES ('TRIP-TDS-01', 'COMPANY', 'OWN_FLEET', $1, $2, '2026-06-15', 'COMPLETED', $3)
        RETURNING id
      `, [partyId, ofvId, ownerId])).rows[0].id;
      await pool.query(`
        INSERT INTO trip_party_financials (trip_id, freight_amount, tds_amount)
        VALUES ($1, 50000.00, 1000.00)
      `, [tripTds1]);

      tripTds2 = (await pool.query(`
        INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by)
        VALUES ('TRIP-TDS-02', 'COMPANY', 'OWN_FLEET', $1, $2, '2026-07-20', 'COMPLETED', $3)
        RETURNING id
      `, [partyIdB, ofvId, ownerId])).rows[0].id;
      await pool.query(`
        INSERT INTO trip_party_financials (trip_id, freight_amount, tds_amount)
        VALUES ($1, 30000.00, 600.00)
      `, [tripTds2]);

      await pool.query('BEGIN');
      try {
        // Insert Bills with items and versions to respect schema constraints
        bill1 = (await pool.query(`
          INSERT INTO bills (bill_number, party_id, financial_year_id, billing_mode, bill_date, bill_status, created_by)
          VALUES ('BILL-001', $1, $2, 'INDIVIDUAL', '2026-06-20', 'GENERATED', $3)
          RETURNING id
        `, [partyId, fyId, ownerId])).rows[0].id;

        await pool.query(`
          INSERT INTO bill_items (bill_id, sequence_no, description, line_amount)
          VALUES ($1, 1, 'Freight Item 1', 50000.00)
        `, [bill1]);

        const bv1 = (await pool.query(`
          INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_snapshot, created_by)
          VALUES ($1, 1, 'Version 1', 'ACTIVE', '{"layout":{},"components":[],"assets":[],"dynamic_field_definitions":[]}'::jsonb, $2)
          RETURNING id
        `, [bill1, ownerId])).rows[0].id;

        await pool.query(`
          INSERT INTO bill_version_items (bill_version_id, sequence_no, description, line_amount)
          VALUES ($1, 1, 'Freight Item 1', 50000.00)
        `, [bv1]);

        bill2 = (await pool.query(`
          INSERT INTO bills (bill_number, party_id, financial_year_id, billing_mode, bill_date, bill_status, created_by)
          VALUES ('BILL-002', $1, $2, 'INDIVIDUAL', '2026-07-25', 'GENERATED', $3)
          RETURNING id
        `, [partyIdB, fyId, ownerId])).rows[0].id;

        await pool.query(`
          INSERT INTO bill_items (bill_id, sequence_no, description, line_amount)
          VALUES ($1, 1, 'Freight Item 2', 30000.00)
        `, [bill2]);

        const bv2 = (await pool.query(`
          INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_snapshot, created_by)
          VALUES ($1, 1, 'Version 1', 'ACTIVE', '{"layout":{},"components":[],"assets":[],"dynamic_field_definitions":[]}'::jsonb, $2)
          RETURNING id
        `, [bill2, ownerId])).rows[0].id;

        await pool.query(`
          INSERT INTO bill_version_items (bill_version_id, sequence_no, description, line_amount)
          VALUES ($1, 1, 'Freight Item 2', 30000.00)
        `, [bv2]);

        // Create payments and allocations to test allocated and outstanding derivation
        const payBill1 = (await pool.query(`
          INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by)
          VALUES ('PAY-BILL-01', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-21', 30000.00, 'BANK_TRANSFER', 'ACTIVE', $2)
          RETURNING id
        `, [partyId, ownerId])).rows[0].id;
        await pool.query(`
          INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, bill_id, allocation_status, created_by)
          VALUES ($1, 'BILL', 30000.00, $2, 'ACTIVE', $3)
        `, [payBill1, bill1, ownerId]);

        const payBill2 = (await pool.query(`
          INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by)
          VALUES ('PAY-BILL-02', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-07-26', 30000.00, 'BANK_TRANSFER', 'ACTIVE', $2)
          RETURNING id
        `, [partyIdB, ownerId])).rows[0].id;
        await pool.query(`
          INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, bill_id, allocation_status, created_by)
          VALUES ($1, 'BILL', 30000.00, $2, 'ACTIVE', $3)
        `, [payBill2, bill2, ownerId]);

        await pool.query('COMMIT');
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    });

    it('TDS Report: returns all matching records and totals when unfiltered', async () => {
      const res = await request(app)
        .get('/api/reports/tds')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.total).toBe(1600);
      expect(res.body.data.items.length).toBe(2);
    });

    it('TDS Report: filters by date range (June only)', async () => {
      const res = await request(app)
        .get('/api/reports/tds?fromDate=2026-06-01&toDate=2026-06-30')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.total).toBe(1000);
      expect(res.body.data.items[0].trip_number).toBe('TRIP-TDS-01');
    });

    it('TDS Report: filters by exact boundary date', async () => {
      const res = await request(app)
        .get('/api/reports/tds?fromDate=2026-06-15&toDate=2026-06-15')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.total).toBe(1000);
      expect(res.body.data.items[0].trip_number).toBe('TRIP-TDS-01');
    });

    it('TDS Report: filters by partyId', async () => {
      const res = await request(app)
        .get(`/api/reports/tds?partyId=${partyIdB}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.total).toBe(600);
      expect(res.body.data.items[0].trip_number).toBe('TRIP-TDS-02');
    });

    it('TDS Report: returns 0 count and 0 total when date range has no matches', async () => {
      const res = await request(app)
        .get('/api/reports/tds?fromDate=2026-01-01&toDate=2026-01-31')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it('Bill Reconciliation: returns authoritative aggregated totals when unfiltered', async () => {
      const res = await request(app)
        .get('/api/reports/bill-reconciliation')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.totalBilled).toBe(80000);
      expect(res.body.data.totalAllocated).toBe(60000); // (50000-20000) + (30000-0)
      expect(res.body.data.totalOutstanding).toBe(20000); // 20000 + 0
    });

    it('Bill Reconciliation: filters by date range (June only)', async () => {
      const res = await request(app)
        .get('/api/reports/bill-reconciliation?fromDate=2026-06-01&toDate=2026-06-30')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.totalBilled).toBe(50000);
      expect(res.body.data.totalAllocated).toBe(30000);
      expect(res.body.data.totalOutstanding).toBe(20000);
      expect(res.body.data.items[0].bill_number).toBe('BILL-001');
    });

    it('Bill Reconciliation: filters by partyId', async () => {
      const res = await request(app)
        .get(`/api/reports/bill-reconciliation?partyId=${partyIdB}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.totalBilled).toBe(30000);
      expect(res.body.data.totalAllocated).toBe(30000);
      expect(res.body.data.totalOutstanding).toBe(0);
      expect(res.body.data.items[0].bill_number).toBe('BILL-002');
    });

    it('Bill Reconciliation: filters by financialYearId', async () => {
      const res = await request(app)
        .get(`/api/reports/bill-reconciliation?financialYearId=${fyId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(2);
      expect(res.body.data.totalBilled).toBe(80000);
    });

    it('Bill Reconciliation: returns 0 counts and 0 totals when no matching bills', async () => {
      const res = await request(app)
        .get('/api/reports/bill-reconciliation?fromDate=2025-01-01&toDate=2025-01-31')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
      expect(res.body.data.totalBilled).toBe(0);
      expect(res.body.data.totalAllocated).toBe(0);
      expect(res.body.data.totalOutstanding).toBe(0);
      expect(res.body.data.items).toEqual([]);
    });

    it('Payment Modes: filters by date range correctly', async () => {
      const res = await request(app)
        .get('/api/reports/payment-modes?fromDate=2026-06-01&toDate=2026-06-01')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].payment_mode).toBe('BANK_TRANSFER');
      expect(parseFloat(res.body.data[0].incoming_amount)).toBe(5000);
    });
  });
});
