import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let partyId: string;
let fyId: string;

beforeAll(async () => {
  await pool.query('TRUNCATE users, parties, trips, own_fleet_vehicles, payments, payment_allocations, party_credits, financial_years CASCADE');
  
  const ownerId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const jwt = require('jsonwebtoken'); 
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });

  partyId = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Party A', '1111111111') RETURNING id`)).rows[0].id;

  fyId = (await pool.query(`INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('2026-27', '2026-04-01', '2027-03-31', true) RETURNING id`)).rows[0].id;
  // We need an own fleet vehicle
  const ofvId = (await pool.query(`INSERT INTO own_fleet_vehicles (vehicle_number) VALUES ('MH12AB1234') RETURNING id`)).rows[0].id;
  const tripIdA = (await pool.query(`INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by) VALUES ('TRIP-001', 'COMPANY', 'OWN_FLEET', $1, $2, NOW(), 'CREATED', $3) RETURNING id`, [partyId, ofvId, ownerId])).rows[0].id;

  const categoryId = (await pool.query(`INSERT INTO other_business_categories (category_type, category_name, created_by) VALUES ('PAYMENT', 'TEST_EXPENSE', $1) RETURNING id`, [ownerId])).rows[0].id;
  
  
  
  
  await pool.query('BEGIN');
  try {
    const pay1 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-001', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-01', 5000.00, 'BANK_TRANSFER', 'ACTIVE', $2) RETURNING id`, [partyId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, allocation_status, created_by) VALUES ($1, 'TRIP', 5000.00, $2, 'ACTIVE', $3)`, [pay1, tripIdA, ownerId]);
    
    const pay2 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by) VALUES ('PAY-002', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-06-02', 2000.00, 'UPI', 'ACTIVE', $2) RETURNING id`, [partyId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, allocation_status, created_by) VALUES ($1, 'TRIP', 2000.00, $2, 'ACTIVE', $3)`, [pay2, tripIdA, ownerId]);

    const pay3 = (await pool.query(`INSERT INTO payments (payment_id, payment_type, category, payment_date, amount, payment_mode, payment_status, other_business_category_id, created_by) VALUES ('PAY-003', 'OUTGOING', 'OTHER_BUSINESS_PAYMENT', '2026-06-03', 1000.00, 'CASH', 'ACTIVE', $1, $2) RETURNING id`, [categoryId, ownerId])).rows[0].id;
    await pool.query(`INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, allocation_status, created_by) VALUES ($1, 'OTHER_BUSINESS', 1000.00, 'ACTIVE', $2)`, [pay3, ownerId]);

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
});
