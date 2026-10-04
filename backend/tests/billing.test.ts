import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let staffToken: string;

let partyId: string;
let tripId1: string;
let tripId2: string;
let fyId: string;
let numberingSeriesId: string;
let billId: string;

beforeAll(async () => {
  await pool.query('TRUNCATE users, parties, trips, bills, bill_items, bill_versions, bill_version_items, bill_numbering_series, financial_years, market_vehicles, vehicle_owners CASCADE');
  
  const ownerId = (await pool.query("INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id", [await hashPassword('pass')])).rows[0].id;
  const staffId = (await pool.query("INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff', 'STAFF', '9999999992', $1, true) RETURNING id", [await hashPassword('pass')])).rows[0].id;
  
  const jwt = require('jsonwebtoken'); 
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });
  staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });

  fyId = (await pool.query("INSERT INTO financial_years (code, start_date, end_date, is_active) VALUES ('FY26', '2026-04-01', '2027-03-31', true) RETURNING id")).rows[0].id;
  
  partyId = (await pool.query("INSERT INTO parties (name, primary_mobile, party_type, is_active) VALUES ('Test Party', '9999999999', 'MARKET_PARTY', true) RETURNING id")).rows[0].id;
  
  numberingSeriesId = (await pool.query("INSERT INTO bill_numbering_series (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by) VALUES ($1, $2, 'SER1', 'INV-', 0, true, $3) RETURNING id", [partyId, fyId, ownerId])).rows[0].id;
  
  const voId = (await pool.query("INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Test VO', '8888888888') RETURNING id")).rows[0].id;
  const mvId = (await pool.query("INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active) VALUES ('MH12AB1234', $1, true) RETURNING id", [voId])).rows[0].id;

  tripId1 = (await pool.query("INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, status, trip_date, created_by) VALUES ('TRP-1', $1, 'MARKET', 'MARKET', $2, 'COMPLETED', '2026-10-01', $3) RETURNING id", [partyId, mvId, ownerId])).rows[0].id;

  tripId2 = (await pool.query("INSERT INTO trips (trip_number, party_id, trip_type, vehicle_relationship, market_vehicle_id, status, trip_date, created_by) VALUES ('TRP-2', $1, 'MARKET', 'MARKET', $2, 'COMPLETED', '2026-10-02', $3) RETURNING id", [partyId, mvId, ownerId])).rows[0].id;

  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId1]);
  await pool.query("INSERT INTO trip_pods (trip_id, pod_status, pod_received_at) VALUES ($1, 'RECEIVED', now())", [tripId2]);
  
  await pool.query("INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 15000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount", [tripId1]);
  await pool.query("INSERT INTO trip_party_financials (trip_id, freight_amount) VALUES ($1, 20000) ON CONFLICT (trip_id) DO UPDATE SET freight_amount = EXCLUDED.freight_amount", [tripId2]);
});

afterAll(async () => {
  await pool.end();
});

describe('Billing Engine', () => {
  it('should check eligibility', async () => {
    const res = await request(app)
      .post('/api/bills/eligibility')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        party_id: partyId,
        trip_ids: [tripId1, tripId2]
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].is_eligible).toBe(true);
  });

  it('should generate a bill', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', 'Bearer ' + ownerToken)
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
    expect(res.body.data.bill.bill_number).toBe('INV-1');
    expect(res.body.data.bill.total_amount).toBe('35000.00'); 
    
    billId = res.body.data.bill.id;
  });

  it('should not allow generating a bill with already billed trips', async () => {
    const res = await request(app)
      .post('/api/bills')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({
        party_id: partyId,
        financial_year_id: fyId,
        numbering_series_id: numberingSeriesId,
        billing_mode: 'INDIVIDUAL',
        bill_date: '2026-10-04',
        trip_ids: [tripId1],
        template_snapshot: {}
      });
    expect(res.status).toBe(422);
  });

  it('should get bill details', async () => {
    const res = await request(app)
      .get('/api/bills/' + billId)
      .set('Authorization', 'Bearer ' + ownerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(2);
    expect(res.body.data.versions.length).toBe(1);
  });

  it('should submit a bill', async () => {
    const res = await request(app)
      .post('/api/bills/' + billId + '/submit')
      .set('Authorization', 'Bearer ' + ownerToken);
    expect(res.status).toBe(200);
    expect(res.body.data.bill_status).toBe('SUBMITTED');
  });

  it('staff should not be able to cancel a bill', async () => {
    const res = await request(app)
      .post('/api/bills/' + billId + '/cancel')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ cancel_reason: 'Mistake' });
    expect(res.status).toBe(403);
  });

  it('owner should be able to cancel a bill', async () => {
    const res = await request(app)
      .post('/api/bills/' + billId + '/cancel')
      .set('Authorization', 'Bearer ' + ownerToken)
      .send({ cancel_reason: 'Mistake' });
    expect(res.status).toBe(200);
    expect(res.body.data.bill_status).toBe('CANCELLED');
  });
});
