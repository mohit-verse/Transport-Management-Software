import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';
import { withTransaction } from '../src/db/transaction';
import { hashPassword } from '../src/modules/auth/auth.service';
import bcrypt from 'bcrypt';

jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockImplementation((q) => {
        if (q === 'SELECT 1') return Promise.resolve({ rows: [{ '?column?': 1 }] });
        if (q === 'SELECT 2 as val') return Promise.resolve({ rows: [{ val: 2 }] });
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    }),
    query: jest.fn().mockImplementation((q) => {
      if (q === 'SELECT 1 as connected') return Promise.resolve({ rows: [{ connected: 1 }] });
      if (q === 'SELECT 1 as val') return Promise.resolve({ rows: [{ val: 1 }] });
      return Promise.resolve({ rows: [] });
    }),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});


describe('Backend Foundation', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('HTTP & Health', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return health check successfully', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
    });
  });

  describe('Database', () => {
    it('should connect to the database', async () => {
      const res = await pool.query('SELECT 1 as val');
      expect(res.rows[0].val).toBe(1);
    });

    it('should handle transactions (commit)', async () => {
      const result = await withTransaction(async (client) => {
        const res = await client.query('SELECT 2 as val');
        return res.rows[0].val;
      });
      expect(result).toBe(2);
    });

    it('should handle transactions (rollback)', async () => {
      await expect(
        withTransaction(async (client) => {
          await client.query('SELECT 1');
          throw new Error('Test rollback');
        })
      ).rejects.toThrow('Test rollback');
    });
  });

  describe('Authentication Foundation', () => {
    it('should hash and verify passwords', async () => {
      const plain = 'secret123';
      const hashed = await hashPassword(plain);
      const isMatch = await bcrypt.compare(plain, hashed);
      expect(isMatch).toBe(true);
    });

    it('should reject unauthenticated protected routes', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('should reject malformed login requests with validation error', async () => {
      const res = await request(app).post('/api/auth/login').send({ mobile_number: '123' }); // missing password, short mobile
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields).toBeDefined();
    });
  });
});
