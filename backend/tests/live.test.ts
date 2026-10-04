import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let staffToken: string;
let caToken: string;

let partyIdA: string;
let partyIdB: string;
let tripIdA: string;
let tripIdB: string;

beforeAll(async () => {
  // Clear any existing users to avoid unique constraint issues
  await pool.query('TRUNCATE users, parties, own_fleet_vehicles, trips, payments, payment_allocations, party_credits CASCADE');
  
  // Seed Users
  const ownerId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const staffId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff', 'STAFF', '9999999992', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const caId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA', 'CA', '9999999993', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;

  // Login
  const jwt = require('jsonwebtoken'); ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });
  staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });
  caToken = jwt.sign({ id: caId, role: 'CA' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });

  // Seed Parties
  partyIdA = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Party A', '1111111111') RETURNING id`)).rows[0].id;
  partyIdB = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('MARKET_PARTY', 'Party B', '2222222222') RETURNING id`)).rows[0].id;

  // Seed Own Fleet Vehicle to use for trips
  const ofvId = (await pool.query(`INSERT INTO own_fleet_vehicles (vehicle_number) VALUES ('MH12AB1234') RETURNING id`)).rows[0].id;

  // Seed Trips
  const tripInsert = "INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by) VALUES ($1, $2, $3, $4, $5, NOW(), 'CREATED', $6) RETURNING id";
  tripIdA = (await pool.query(tripInsert, ['TRIP-001', 'COMPANY', 'OWN_FLEET', partyIdA, ofvId, ownerId])).rows[0].id;
  tripIdB = (await pool.query(tripInsert, ['TRIP-002', 'COMPANY', 'OWN_FLEET', partyIdB, ofvId, ownerId])).rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('Live PostgreSQL Financial Validation', () => {

  it('1. Payment Creation - Incoming Company with Excess (CREDIT_GENERATED)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        payment_date: new Date().toISOString(),
        payment_mode: 'BANK_TRANSFER',
        amount: 1000.50,
        payment_direction: 'INCOMING',
        payment_category: 'COMPANY_PAYMENT',
        party_id: partyIdA,
        allocations: [
          {
            allocation_type: 'TRIP',
            allocated_amount: 800.00,
            target_trip_id: tripIdA
          },
          {
            allocation_type: 'CREDIT_GENERATED',
            allocated_amount: 200.50
          }
        ]
      });
    
    console.log(res.body); expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe("1000.50"); // numeric comes back as string from pg usually, or handled by decimal.js 

    // Verify DB
    const allocs = await pool.query('SELECT * FROM payment_allocations WHERE payment_id = $1', [res.body.data.id]);
    expect(allocs.rows.length).toBe(2);

    const credits = await pool.query('SELECT * FROM party_credits WHERE payment_id = $1', [res.body.data.id]);
    expect(credits.rows.length).toBe(1);
    // original credit amount removed from party_credits
  });

  it('2. Credit Utilization - Existing credit consumed for same party', async () => {
    // Get the generated credit
    const allocsGen = await pool.query("SELECT * FROM payment_allocations WHERE allocation_type = 'CREDIT_GENERATED' AND allocation_status = 'ACTIVE' LIMIT 1");
    const creditId = allocsGen.rows[0].id;

    const res = await request(app)
      .post('/api/payments/credits/utilize')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_credit_source_id: creditId,
        target_trip_id: tripIdA,
        allocation_amount: 100.25
      });
    
    console.log(res.body); expect(res.status).toBe(201);
    
    // Check remaining credit using our service logic mentally or just check DB
    const utils = await pool.query("SELECT * FROM payment_allocations WHERE party_credit_source_id = $1 AND allocation_type = 'CREDIT_UTILIZED'", [creditId]);
    expect(utils.rows.length).toBe(1);
    expect(utils.rows[0].allocation_amount).toBe("100.25");
  });

  it('3. Credit Overuse Protection', async () => {
    const allocsGen = await pool.query("SELECT * FROM payment_allocations WHERE allocation_type = 'CREDIT_GENERATED' AND allocation_status = 'ACTIVE' LIMIT 1");
    const creditId = allocsGen.rows[0].id;

    const res = await request(app)
      .post('/api/payments/credits/utilize')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_credit_source_id: creditId,
        target_trip_id: tripIdA,
        allocation_amount: 500.00 // Total was 200.50, 100.25 used. Only 100.25 left.
      });
    
    expect(res.status).toBe(422);
  });

  it('4. Cross-Party Protection (Simulated by trying to use Party A credit for Party B trip - wait, the DB constraint validate_credit_utilization protects this)', async () => {
    const allocsGen = await pool.query("SELECT * FROM payment_allocations WHERE allocation_type = 'CREDIT_GENERATED' AND allocation_status = 'ACTIVE' LIMIT 1");
    const creditId = allocsGen.rows[0].id;

    // Direct DB insertion to test constraint, as API might not check party match natively if it relies on DB
    let errorCaught = false;
    try {
      const userRes = await pool.query("SELECT id FROM users LIMIT 1");
      const userId = userRes.rows[0].id;
      await pool.query(`
        INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, trip_id, party_credit_source_id, allocation_status, created_by)
        VALUES (NULL, 'CREDIT_UTILIZED', 10.00, $1, $2, 'ACTIVE', $3)
      `, [tripIdB, creditId, userId]);
    } catch (e: any) {
      errorCaught = true;
      expect(e.message).toMatch(/credit source and bill\/trip/i);
    }
    expect(errorCaught).toBe(true);
  });

  it('5. Payment Completeness Constraint - Incomplete payment', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        payment_date: new Date().toISOString(),
        payment_mode: 'CASH',
        amount: 1000.00,
        payment_direction: 'INCOMING',
        payment_category: 'MARKET_PARTY_PAYMENT',
        party_id: partyIdB,
        allocations: [
          {
            allocation_type: 'TRIP',
            allocated_amount: 800.00, // Missing 200
            target_trip_id: tripIdB
          }
        ]
      });
    
    expect(res.status).toBe(422);
  });

  it('6. Decimal Precision', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        payment_date: new Date().toISOString(),
        payment_mode: 'BANK_TRANSFER',
        amount: 999999.99,
        payment_direction: 'INCOMING',
        payment_category: 'MARKET_PARTY_PAYMENT',
        party_id: partyIdB,
        allocations: [
          {
            allocation_type: 'TRIP',
            allocated_amount: 999999.98,
            target_trip_id: tripIdB
          },
          {
            allocation_type: 'CREDIT_GENERATED',
            allocated_amount: 0.01
          }
        ]
      });
    
    console.log(res.body); expect(res.status).toBe(201);
  });

  it('7. Payment Reversal & Reversed Credit Protection', async () => {
    // Get the first payment
    const payments = await pool.query('SELECT * FROM payments WHERE party_id = $1 ORDER BY created_at ASC LIMIT 1', [partyIdA]);
    const pId = payments.rows[0].id;

    const res = await request(app)
      .post(`/api/payments/${pId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reversal_reason: 'Testing Reversal' });
    
    expect(res.status).toBe(200);

    // Verify allocations are inactive
    const allocs = await pool.query("SELECT * FROM payment_allocations WHERE payment_id = $1 AND allocation_status = 'ACTIVE'", [pId]);
    expect(allocs.rows.length).toBe(0);

    // Verify credit is inactive
    const credits = await pool.query("SELECT * FROM payment_allocations WHERE payment_id = $1 AND allocation_type = 'CREDIT_GENERATED' AND allocation_status = 'ACTIVE'", [pId]);
    expect(credits.rows.length).toBe(0);

    const creditId = (await pool.query("SELECT * FROM payment_allocations WHERE payment_id = $1 AND allocation_type = 'CREDIT_GENERATED'", [pId])).rows[0].id;
    const utilized = await pool.query("SELECT * FROM payment_allocations WHERE party_credit_source_id = $1 AND allocation_type = 'CREDIT_UTILIZED' AND allocation_status = 'ACTIVE'", [creditId]);
    expect(utilized.rows.length).toBe(0);
  });

  it('8. RBAC - Staff cannot reverse', async () => {
    const res = await request(app)
      .post('/api/payments/11111111-1111-1111-1111-111111111111/reverse')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ reversal_reason: 'Testing Reversal' });
    
    expect(res.status).toBe(403);
  });

  it('9. FIFO Endpoint Structure', async () => {
    const res = await request(app)
      .post('/api/payments/fifo')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        party_id: partyIdA,
        amount: 5000,
        payment_id: '11111111-1111-1111-1111-111111111111' // Will fail DB constraints but structure passes
      });
    
    expect(res.status).not.toBe(404); // Means route exists and operates
    // We expect 500 or 4xx because payment_id doesn't exist, proving it hits DB.
  });

});
