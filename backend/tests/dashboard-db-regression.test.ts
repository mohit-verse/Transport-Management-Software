import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

/**
 * Opt-in Staging Database Schema Regression Test for Dashboard Queries
 * 
 * Fails closed unless RUN_STAGING_DASHBOARD_REGRESSION === 'true'.
 * Strictly READ-ONLY: Never executes migrations, seeds, inserts, updates, or deletes.
 */
const shouldRun = process.env.RUN_STAGING_DASHBOARD_REGRESSION === 'true';

// If explicitly opted in, ensure staging configuration from root .env is loaded
if (shouldRun) {
  const rootEnvPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath, override: true });
  }
}

(shouldRun ? describe : describe.skip)('Dashboard Staging Schema Regression (Read-Only)', () => {
  let stagingPool: Pool;
  let getDashboardData: typeof import('../src/modules/dashboard/dashboard.service').getDashboardData;

  beforeAll(async () => {
    const stagingUrl = process.env.DATABASE_URL;
    if (!stagingUrl) {
      throw new Error('DATABASE_URL must be configured when RUN_STAGING_DASHBOARD_REGRESSION=true');
    }

    const caPath = path.resolve(__dirname, '../certs/prod-ca-2021.crt');
    const ca = fs.existsSync(caPath) ? fs.readFileSync(caPath).toString() : undefined;

    stagingPool = new Pool({
      connectionString: stagingUrl,
      ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
    });

    // Dynamically import dashboard service after env is configured so its internal pool points to staging
    const dashboardModule = await import('../src/modules/dashboard/dashboard.service');
    getDashboardData = dashboardModule.getDashboardData;
  });

  afterAll(async () => {
    if (stagingPool) {
      await stagingPool.end();
    }
    // Also close default db pool if initialized
    try {
      const { pool } = await import('../src/db');
      await pool.end();
    } catch {
      // ignore
    }
  });

  it('verifies own-fleet query executes without column 42703 errors against real schema', async () => {
    const res = await stagingPool.query(`
      SELECT COUNT(*) FROM trips 
      WHERE vehicle_relationship = 'OWN_FLEET' AND status != 'CANCELLED'
    `);
    expect(res.rows).toBeDefined();
    expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(0);
  });

  it('verifies pending POD query executes against real trip_pods and trips schema', async () => {
    const res = await stagingPool.query(`
      SELECT COUNT(DISTINCT t.id) FROM trips t
      JOIN trip_pods tp ON tp.trip_id = t.id
      WHERE tp.pod_status = 'PENDING' AND t.status != 'CANCELLED'
    `);
    expect(res.rows).toBeDefined();
    expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(0);
  });

  it('verifies unpaid bills query executes against canonical bill_status schema', async () => {
    const res = await stagingPool.query(`
      SELECT COUNT(*) FROM bills 
      WHERE bill_status IN ('GENERATED', 'SUBMITTED')
    `);
    expect(res.rows).toBeDefined();
    expect(parseInt(res.rows[0].count, 10)).toBeGreaterThanOrEqual(0);
  });

  it('executes getDashboardData() end-to-end without SQL syntax or column mismatch errors', async () => {
    const mockUser = { id: '00000000-0000-0000-0000-000000000000', name: 'Test User', role: 'OWNER' };
    const data = await getDashboardData(mockUser, {});
    expect(data).toBeDefined();
    expect(data.businessSnapshot).toHaveProperty('totalTrips');
    expect(data.businessSnapshot).toHaveProperty('ownFleetTrips');
    expect(data.needsAttention).toHaveProperty('pendingPodTrips');
    expect(data.needsAttention).toHaveProperty('unpaidBills');
  });
});
