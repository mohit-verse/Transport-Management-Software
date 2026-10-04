import request from 'supertest';
import { app } from '../src/app';

// Mock DB
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn().mockImplementation((q: string) => {
      if (q.includes('COUNT(*) FROM trips WHERE status != \'CANCELLED\'')) {
        return Promise.resolve({ rows: [{ count: '10' }] });
      }
      if (q.includes('COUNT(*) FROM trips WHERE status = \'PENDING_POD\'')) {
        return Promise.resolve({ rows: [{ count: '2' }] });
      }
      if (q.includes('COUNT(*) FROM bills WHERE bill_status')) {
        return Promise.resolve({ rows: [{ count: '3' }] });
      }
      if (q.includes('SELECT id, trip_number, trip_date, status')) {
        return Promise.resolve({ rows: [{ id: 't1', trip_number: 'TRIP-1' }] });
      }
      if (q.includes('SELECT id, payment_date, payment_type')) {
        return Promise.resolve({ rows: [{ id: 'p1', amount: 100 }] });
      }
      if (q.includes('COUNT(*) FROM trips \n    WHERE ownership_type = \'OWN_FLEET\'')) {
        return Promise.resolve({ rows: [{ count: '5' }] });
      }
      // For getFinancialSummary mocking inside reports.service
      if (q.includes('SUM(amount) as total_incoming')) {
        return Promise.resolve({ rows: [{ total_incoming: '1000' }] });
      }
      if (q.includes('SUM(amount) as total_outgoing')) {
        return Promise.resolve({ rows: [{ total_outgoing: '500' }] });
      }
      return Promise.resolve({ rows: [] });
    }),
    end: jest.fn()
  }
}));

// Mock auth middleware to skip real auth checks
jest.mock('../src/middlewares/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'u1', name: 'Owner', role: 'OWNER' };
    next();
  }
}));

describe('Phase 3F - Dashboard', () => {
  it('GET /api/dashboard should return dashboard statistics', async () => {
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.header.user.name).toBe('Owner');
    expect(res.body.data.businessSnapshot.totalTrips).toBe(10);
    expect(res.body.data.businessSnapshot.ownFleetTrips).toBe(5);
    expect(res.body.data.needsAttention.pendingPodTrips).toBe(2);
    expect(res.body.data.needsAttention.unpaidBills).toBe(3);
    expect(res.body.data.recentTrips.length).toBe(1);
    expect(res.body.data.recentPayments.length).toBe(1);
  });
});
