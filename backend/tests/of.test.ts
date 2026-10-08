import request from 'supertest';
import { app } from '../src/app';
import { pool } from '../src/db';

jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
  },
  query: jest.fn()
}));

jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'u1', name: 'Owner', role: 'OWNER' };
    next();
  }
}));

describe('Own Fleet Backend Contract', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/own-fleet/:id/trips should return trips', async () => {
    const { query } = require('../src/db');
    query.mockResolvedValueOnce({ rows: [{ id: 't1', trip_number: 'TRIP-123' }] });

    const res = await request(app).get('/api/own-fleet/v1/trips');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM trips WHERE own_fleet_vehicle_id = $1'), ['v1']);
  });

  it('GET /api/own-fleet/:id/expenses should return expenses and allocations', async () => {
    const { query } = require('../src/db');
    query.mockResolvedValueOnce({ rows: [{ id: 'e1', amount: 500 }] }); // expenses
    query.mockResolvedValueOnce({ rows: [{ id: 'pa1', amount: 500 }] }); // payments

    const res = await request(app).get('/api/own-fleet/v1/expenses');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expenses.length).toBe(1);
    expect(res.body.data.paymentAllocations.length).toBe(1);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
