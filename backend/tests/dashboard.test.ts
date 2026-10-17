import request from 'supertest';
import { app } from '../src/app';

const executedQueries: Array<{ sql: string; values?: any[] }> = [];

// Mock DB
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn().mockImplementation((q: string, values?: any[]) => {
      executedQueries.push({ sql: q, values });

      // 1. Total trips
      if (q.includes('COUNT(*) FROM trips WHERE status != \'CANCELLED\'')) {
        return Promise.resolve({ rows: [{ count: '10' }] });
      }
      // 2. Pending POD trips (canonical: joins trip_pods, checks pod_status = 'PENDING', excludes CANCELLED)
      if (q.includes('trip_pods') && q.includes('pod_status = \'PENDING\'')) {
        return Promise.resolve({ rows: [{ count: '2' }] });
      }
      // 3. Unpaid bills (canonical: bill_status IN ('GENERATED', 'SUBMITTED'))
      if (q.includes('bills') && q.includes("'GENERATED', 'SUBMITTED'")) {
        return Promise.resolve({ rows: [{ count: '3' }] });
      }
      // 4. Recent trips
      if (q.includes('SELECT id, trip_number, trip_date, status')) {
        return Promise.resolve({ rows: [{ id: 't1', trip_number: 'TRIP-1', trip_date: '2026-10-01', status: 'IN_TRANSIT' }] });
      }
      // 5. Recent payments
      if (q.includes('SELECT id, payment_date, payment_type')) {
        return Promise.resolve({ rows: [{ id: 'p1', amount: 100, payment_status: 'ACTIVE' }] });
      }
      // 6. Own fleet trips (canonical: vehicle_relationship = 'OWN_FLEET', excludes CANCELLED)
      if (q.includes("vehicle_relationship = 'OWN_FLEET'")) {
        return Promise.resolve({ rows: [{ count: '5' }] });
      }
      // Reports service financial summary
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

describe('Dashboard Service & KPI Queries Unit Tests', () => {
  beforeEach(() => {
    executedQueries.length = 0;
  });

  it('GET /api/dashboard returns dashboard statistics with canonical queries', async () => {
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

  it('verifies own-fleet query uses canonical vehicle_relationship and excludes CANCELLED trips', async () => {
    await request(app).get('/api/dashboard');
    const ownFleetQuery = executedQueries.find((item) =>
      item.sql.includes('COUNT(*) FROM trips') && item.sql.includes('vehicle_relationship')
    );

    expect(ownFleetQuery).toBeDefined();
    expect(ownFleetQuery!.sql).toContain("vehicle_relationship = 'OWN_FLEET'");
    expect(ownFleetQuery!.sql).toContain("status != 'CANCELLED'");
    // Ensure the obsolete column ownership_type is NEVER queried
    expect(ownFleetQuery!.sql).not.toContain('ownership_type');
  });

  it('verifies pending POD query joins trip_pods, checks pod_status = PENDING, and counts distinct trips', async () => {
    await request(app).get('/api/dashboard');
    const podQuery = executedQueries.find((item) =>
      item.sql.includes('trip_pods')
    );

    expect(podQuery).toBeDefined();
    expect(podQuery!.sql).toContain('COUNT(DISTINCT t.id)');
    expect(podQuery!.sql).toContain('JOIN trip_pods tp ON tp.trip_id = t.id');
    expect(podQuery!.sql).toContain("tp.pod_status = 'PENDING'");
    expect(podQuery!.sql).toContain("t.status != 'CANCELLED'");
  });

  it('verifies unpaid bills query uses canonical statuses GENERATED and SUBMITTED', async () => {
    await request(app).get('/api/dashboard');
    const billsQuery = executedQueries.find((item) =>
      item.sql.includes('COUNT(*) FROM bills')
    );

    expect(billsQuery).toBeDefined();
    expect(billsQuery!.sql).toContain("bill_status IN ('GENERATED', 'SUBMITTED')");
    // Ensure obsolete / invalid statuses are not used
    expect(billsQuery!.sql).not.toContain('UNPAID');
    expect(billsQuery!.sql).not.toContain('PARTIALLY_PAID');
  });

  it('applies date filters to total trips and own-fleet trip queries', async () => {
    const fromDate = '2026-10-01';
    const toDate = '2026-10-15';
    const res = await request(app).get(`/api/dashboard?fromDate=${fromDate}&toDate=${toDate}`);
    expect(res.status).toBe(200);

    const tripQueriesWithDates = executedQueries.filter((item) =>
      item.sql.includes('trip_date >= $1 AND trip_date <= $2')
    );

    // Both total trips count and own-fleet trips count must have date filters applied
    expect(tripQueriesWithDates.length).toBeGreaterThanOrEqual(2);
    tripQueriesWithDates.forEach((item) => {
      expect(item.values).toEqual([fromDate, toDate]);
    });
  });
});
