import request from 'supertest';
import { app } from '../src/app';

// Mock DB
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn().mockImplementation((q: string, values: any[]) => {
      if (values && values[0] === '%SEARCH%') {
        if (q.includes('FROM trips')) return Promise.resolve({ rows: [{ id: 't1', trip_number: 'TRIP-SEARCH' }] });
        if (q.includes('FROM parties')) return Promise.resolve({ rows: [{ id: 'p1', name: 'SEARCH PARTY' }] });
        if (q.includes('FROM bills')) return Promise.resolve({ rows: [{ id: 'b1', bill_number: 'BILL-SEARCH' }] });
      }
      if (values && values[0] === '%MH12SR%') {
        if (q.includes('FROM own_fleet_vehicles')) return Promise.resolve({ rows: [{ id: 'v1', vehicle_number: 'MH12SR1234', type: 'OWN' }] });
      }
      if (values && values[0] === '%PAY-2026%') {
        if (q.includes('FROM payments')) return Promise.resolve({ rows: [{ id: 'pay-1', payment_id: 'PAY-20261013-1234', amount: '5000', payment_type: 'INCOMING' }] });
      }
      return Promise.resolve({ rows: [] });
    }),
    end: jest.fn()
  }
}));

// Mock auth middleware
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'u1', name: 'Owner', role: 'OWNER' };
    next();
  }
}));

describe('Phase 3F - Global Search', () => {
  it('GET /api/search with no query should return empty results', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trips).toEqual([]);
    expect(res.body.data.parties).toEqual([]);
  });

  it('GET /api/search?q=SEARCH should return matching entities', async () => {
    const res = await request(app).get('/api/search?q=SEARCH');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.trips.length).toBe(1);
    expect(res.body.data.parties.length).toBe(1);
    expect(res.body.data.bills.length).toBe(1);
    expect(res.body.data.vehicles.length).toBe(0);
  });

  it('GET /api/search?q=MH12SR should return matching vehicles', async () => {
    const res = await request(app).get('/api/search?q=MH12SR');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.vehicles.length).toBe(1);
    expect(res.body.data.vehicles[0].vehicle_number).toBe('MH12SR1234');
  });

  it('GET /api/search?q=PAY-2026 should return matching payments by Payment ID', async () => {
    const res = await request(app).get('/api/search?q=PAY-2026');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payments.length).toBe(1);
    expect(res.body.data.payments[0].payment_id).toBe('PAY-20261013-1234');
  });
});
