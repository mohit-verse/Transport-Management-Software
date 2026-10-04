import request from 'supertest';
import { app } from '../src/app';

// Since the DB is mocked in foundation tests (and jest modules might carry it over, or we re-mock),
// we will just do a high-level test that the routes exist and enforce RBAC.
describe('Financial Core Operations', () => {
  it('should require authentication for payments creation', async () => {
    const res = await request(app).post('/api/payments').send({});
    expect(res.status).toBe(401);
  });

  it('should require authentication for credit utilization', async () => {
    const res = await request(app).post('/api/payments/credits/utilize').send({});
    expect(res.status).toBe(401);
  });

  it('should require authentication for FIFO', async () => {
    const res = await request(app).post('/api/payments/fifo').send({});
    expect(res.status).toBe(401);
  });

  it('should require authentication for reversal', async () => {
    const res = await request(app).post('/api/payments/123/reverse').send({});
    expect(res.status).toBe(401);
  });
});
