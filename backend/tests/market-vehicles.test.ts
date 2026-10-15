import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { hashPassword } from '../src/modules/auth/auth.service';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

describe('Market Vehicles API (Role & Operation Audit)', () => {
  let ownerToken: string;
  let staffToken: string;
  let caToken: string;
  let ownerId: string;
  let staffId: string;
  let caId: string;
  let vehicleOwnerId: string;
  let marketVehicleId: string;

  beforeAll(async () => {
    // Truncate dependent tables in cascade for isolated tests
    await pool.query('TRUNCATE users, vehicle_owners, market_vehicles, trips, audit_events CASCADE');

    // Create users with distinct roles
    ownerId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Owner MV', 'OWNER', '9777777771', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    staffId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('Staff MV', 'STAFF', '9777777772', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    caId = (await pool.query(
      `INSERT INTO users (name, role, mobile_number, password_hash, is_active) VALUES ('CA MV', 'CA', '9777777773', $1, true) RETURNING id`,
      [await hashPassword('pass123')]
    )).rows[0].id;

    ownerToken = jwt.sign({ id: ownerId, role: 'OWNER' }, config.jwt.secret, { expiresIn: '1d' });
    staffToken = jwt.sign({ id: staffId, role: 'STAFF' }, config.jwt.secret, { expiresIn: '1d' });
    caToken = jwt.sign({ id: caId, role: 'CA' }, config.jwt.secret, { expiresIn: '1d' });

    // Seed vehicle owner
    vehicleOwnerId = (await pool.query(
      `INSERT INTO vehicle_owners (name, mobile_number) VALUES ('Ramesh Yadav', '9829012345') RETURNING id`
    )).rows[0].id;

    // Seed market vehicle
    marketVehicleId = (await pool.query(
      `INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id) VALUES ('RJ14MV1111', $1) RETURNING id`,
      [vehicleOwnerId]
    )).rows[0].id;
  });

  describe('GET /api/market-vehicles (List RBAC)', () => {
    it('allows OWNER to list market vehicles with owner details', async () => {
      const res = await request(app)
        .get('/api/market-vehicles')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const mv = res.body.data.find((v: any) => v.id === marketVehicleId);
      expect(mv).toBeDefined();
      expect(mv.vehicle_number).toBe('RJ14MV1111');
      expect(mv.owner_name).toBe('Ramesh Yadav');
      expect(mv.owner_mobile_number).toBe('9829012345');
    });

    it('allows STAFF to list market vehicles', async () => {
      const res = await request(app)
        .get('/api/market-vehicles')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('strictly forbids CA from listing market vehicles (returns HTTP 403)', async () => {
      const res = await request(app)
        .get('/api/market-vehicles')
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/market-vehicles/:id (Detail RBAC)', () => {
    it('allows OWNER to fetch market vehicle detail with linked owner information', async () => {
      const res = await request(app)
        .get(`/api/market-vehicles/${marketVehicleId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle_number).toBe('RJ14MV1111');
      expect(res.body.data.vehicle_owner_id).toBe(vehicleOwnerId);
      expect(res.body.data.owner_name).toBe('Ramesh Yadav');
      expect(res.body.data.owner_mobile_number).toBe('9829012345');
      expect(Array.isArray(res.body.data.trips)).toBe(true);
    });

    it('allows STAFF to fetch market vehicle detail', async () => {
      const res = await request(app)
        .get(`/api/market-vehicles/${marketVehicleId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle_number).toBe('RJ14MV1111');
    });

    it('strictly forbids CA from fetching market vehicle detail (returns HTTP 403)', async () => {
      const res = await request(app)
        .get(`/api/market-vehicles/${marketVehicleId}`)
        .set('Authorization', `Bearer ${caToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for non-existent market vehicle when requested by authorized user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/api/market-vehicles/${nonExistentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Mutations: POST and PATCH RBAC', () => {
    it('strictly forbids CA from creating market vehicles (returns HTTP 403)', async () => {
      const res = await request(app)
        .post('/api/market-vehicles')
        .set('Authorization', `Bearer ${caToken}`)
        .send({
          vehicle_number: 'RJ14MV2222',
          vehicle_owner_id: vehicleOwnerId,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids CA from updating market vehicles (returns HTTP 403)', async () => {
      const res = await request(app)
        .patch(`/api/market-vehicles/${marketVehicleId}`)
        .set('Authorization', `Bearer ${caToken}`)
        .send({ vehicle_number: 'RJ14MV9999' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows STAFF to create market vehicle', async () => {
      const res = await request(app)
        .post('/api/market-vehicles')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          vehicle_number: 'RJ14MV3333',
          vehicle_owner_id: vehicleOwnerId,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle_number).toBe('RJ14MV3333');
    });

    it('allows OWNER to update market vehicle', async () => {
      const res = await request(app)
        .patch(`/api/market-vehicles/${marketVehicleId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ vehicle_number: 'RJ14MV1112' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vehicle_number).toBe('RJ14MV1112');
    });
  });
});
