import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';

let ownerToken: string;
let partyId: string;
let tripId: string;
let destId1: string;

beforeAll(async () => {
  await pool.query('TRUNCATE users, parties, trips, trip_destinations, own_fleet_vehicles CASCADE');
  
  const ownerId = (await pool.query(`INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner', 'OWNER', '9999999991', $1, true) RETURNING id`, [await hashPassword('pass')])).rows[0].id;
  const jwt = require('jsonwebtoken'); 
  ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, require('../src/config').config.jwt.secret, { expiresIn: '1d' });

  partyId = (await pool.query(`INSERT INTO parties (party_type, name, primary_mobile) VALUES ('COMPANY', 'Party A', '1111111111') RETURNING id`)).rows[0].id;
  const ofvId = (await pool.query(`INSERT INTO own_fleet_vehicles (vehicle_number) VALUES ('MH12AB1234') RETURNING id`)).rows[0].id;

  const tripInsert = "INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, own_fleet_vehicle_id, trip_date, status, created_by) VALUES ($1, $2, $3, $4, $5, NOW(), 'CREATED', $6) RETURNING id";
  tripId = (await pool.query(tripInsert, ['TRIP-001', 'COMPANY', 'OWN_FLEET', partyId, ofvId, ownerId])).rows[0].id;

  destId1 = (await pool.query("INSERT INTO trip_destinations (trip_id, sequence_no, from_location, to_location, distance_km) VALUES ($1, 1, 'Origin A', 'Dest B', 100) RETURNING id", [tripId])).rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('Trip Core Update', () => {
  it('should update trip core fields and handle destinations', async () => {
    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        driver_mobile_number: '1234567890',
        lr_number: 'LR-123',
        destinations: [
          {
            id: destId1,
            from_location: 'Origin A Edited',
            to_location: 'Dest B',
            distance_km: 150
          },
          {
            from_location: 'Dest B',
            to_location: 'Dest C',
            distance_km: 50
          }
        ]
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tripRes = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
    expect(tripRes.rows[0].driver_mobile_number).toBe('1234567890');
    expect(tripRes.rows[0].lr_number).toBe('LR-123');

    const destRes = await pool.query('SELECT * FROM trip_destinations WHERE trip_id = $1 ORDER BY sequence_no ASC', [tripId]);
    expect(destRes.rows.length).toBe(2);
    expect(destRes.rows[0].from_location).toBe('Origin A Edited');
    expect(destRes.rows[0].distance_km).toBe('150.00');
    expect(destRes.rows[1].sequence_no).toBe(2);
    expect(destRes.rows[1].from_location).toBe('Dest B');
  });

  it('should prevent deletion of destination if it has linked financial records', async () => {
    const ownerIdRes = await pool.query("SELECT id FROM users LIMIT 1");
    const ownerId = ownerIdRes.rows[0].id;

    await pool.query(
      "INSERT INTO trip_unloading_charges (trip_id, trip_destination_id, side, amount, created_by) VALUES ($1, $2, 'PARTY', 500, $3)",
      [tripId, destId1, ownerId]
    );

    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        destinations: [
          {
            from_location: 'New Origin',
            to_location: 'New Dest',
            distance_km: 200
          }
        ]
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Cannot remove destination with linked financial records');
  });
});

describe('Trip Detail Read API', () => {
  it('should fetch complete trip details', async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(tripId);
    expect(res.body.data.party.id).toBe(partyId);
    expect(res.body.data.destinations.length).toBeGreaterThan(0);
    expect(res.body.data.financials).toBeDefined();
  });
  
  it('should return 404 for non-existent trip', async () => {
    const fakeId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app)
      .get(`/api/trips/${fakeId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    
    expect(res.status).toBe(404);
  });
});
