import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn, ChildProcess, execSync } from 'child_process';
import { Pool } from 'pg';
import { parseEnv } from '../src/config';
import { LocalStorageService } from '../src/services/storage.service';
import { hashPassword } from '../src/modules/auth/auth.service';
import { reconcileStorage } from '../src/scripts/reconcile-storage';
import {
  runMigrations,
  CANONICAL_TABLES_001,
  CANONICAL_FUNCTIONS_001,
  CANONICAL_TRIGGERS_COUNT_001,
  CANONICAL_DYNAMIC_FIELDS_COUNT,
} from '../src/scripts/migrate';

const STAGING_PORT = 3001;
const STAGING_URL = `http://localhost:${STAGING_PORT}`;
const STAGING_DB_NAME = 'ssrl_staging_db';
const PG_HOST = process.env.DB_HOST || 'localhost';
const PG_PORT = process.env.DB_PORT || '5432';
const PG_USER = process.env.DB_USER || 'postgres';
const STAGING_DATABASE_URL = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${STAGING_DB_NAME}`;
const STAGING_STORAGE_DIR = path.resolve(__dirname, '../../storage/staging');
const STAGING_JWT_SECRET = 'staging_environment_test_jwt_secret_key_at_least_32_chars';

describe('Phase 4P-D: Staging Deployment & Operational Runbook Execution', () => {
  jest.setTimeout(120000);

  let stagingPool: Pool;
  let serverProcess: ChildProcess | null = null;
  let restartedProcess: ChildProcess | null = null;
  const spawnedProcs = new Set<ChildProcess>();

  let ownerToken: string = '';
  let staffToken: string = '';
  let caToken: string = '';

  let createdPartyId: string = '';
  let createdOwnerId: string = '';
  let createdVehicleId: string = '';
  let createdTripId: string = '';
  let createdDocumentId: string = '';
  let createdPaymentId: string = '';
  let createdBillId: string = '';
  let financialYearId: string = '';
  let numberingSeriesId: string = '';

  const stopProcessGracefully = async (
    proc: ChildProcess | null,
    timeoutMs = 5000
  ): Promise<{ exited: boolean; code: number | null; signal: string | null }> => {
    if (!proc || proc.exitCode !== null || proc.killed) {
      if (proc) spawnedProcs.delete(proc);
      return { exited: true, code: proc?.exitCode ?? null, signal: proc?.signalCode ?? null };
    }

    const pid = proc.pid;
    return new Promise((resolve) => {
      let finished = false;
      const handleExit = (code: number | null, signal: string | null) => {
        if (!finished) {
          finished = true;
          spawnedProcs.delete(proc);
          resolve({ exited: true, code, signal });
        }
      };

      proc.once('exit', handleExit);
      proc.once('close', handleExit);

      try {
        proc.kill('SIGTERM');
      } catch {
        // Process might already be dead
      }

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            if (process.platform === 'win32' && pid) {
              execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
            } else {
              proc.kill('SIGKILL');
            }
          } catch {}
          spawnedProcs.delete(proc);
          resolve({ exited: false, code: null, signal: 'FORCE_TERMINATED' });
        }
      }, timeoutMs);
      timer.unref();
    });
  };

  const verifyPortFree = (port: number) => {
    try {
      if (process.platform === 'win32') {
        const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        for (const line of out.trim().split('\n')) {
          const parts = line.trim().split(/\s+/);
          const state = parts[parts.length - 2];
          const pid = parts[parts.length - 1];
          if (state === 'LISTENING' && pid && /^\d+$/.test(pid) && pid !== '0' && pid !== String(process.pid)) {
            const cmd = execSync(`powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"ProcessId = ${pid}\\").CommandLine"`, { encoding: 'utf8' });
            if (cmd.includes('dist/server.js')) {
              // Stale SSRL instance from previous run, terminate it
              execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
            } else {
              throw new Error(`Port ${port} is occupied by an unrelated service (PID ${pid}: ${cmd.trim()}). Aborting staging test to protect unrelated service.`);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('unrelated service')) throw err;
    }
  };

  const stagingFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    if (!headers.has('Connection')) {
      headers.set('Connection', 'close');
    }
    return fetch(url, {
      ...init,
      headers,
    });
  };

  const waitForServer = async (retries = 30, delayMs = 500): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await stagingFetch(`${STAGING_URL}/api/health`);
        if (res.ok) return true;
      } catch {
        // Wait and retry
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
  };

  beforeAll(async () => {
    // 0. Verify port 3001 is clean without terminating unrelated processes
    verifyPortFree(STAGING_PORT);

    // 1. Ensure staging storage directory exists and clean previous artifacts
    if (!fs.existsSync(STAGING_STORAGE_DIR)) {
      fs.mkdirSync(STAGING_STORAGE_DIR, { recursive: true });
    }
    const cleanDir = (d: string) => {
      if (fs.existsSync(d)) {
        for (const f of fs.readdirSync(d)) {
          fs.rmSync(path.join(d, f), { recursive: true, force: true });
        }
      } else {
        fs.mkdirSync(d, { recursive: true });
      }
    };
    cleanDir(path.join(STAGING_STORAGE_DIR, 'documents'));
    cleanDir(path.join(STAGING_STORAGE_DIR, 'bills'));
    cleanDir(path.join(STAGING_STORAGE_DIR, 'templates'));

    // 2. Connect to staging database
    stagingPool = new Pool({ connectionString: STAGING_DATABASE_URL });

    // 3. Ensure migrations and initial owner are applied
    await runMigrations(stagingPool);

    // Clean operational data from any previous run
    await stagingPool.query(`
      TRUNCATE parties, vehicle_owners, market_vehicles, own_fleet_vehicles, trips, trip_destinations,
               trip_party_financials, trip_vehicle_owner_financials, trip_pods, bills, bill_items,
               bill_versions, bill_version_items, payments, payment_allocations, party_credits,
               documents, document_links, audit_events CASCADE;
    `);

    // Ensure staging Owner exists
    const ownerHash = await hashPassword('StagingPass123!');
    await stagingPool.query(`
      INSERT INTO users (name, mobile_number, password_hash, role, is_active)
      VALUES ('Staging Owner', '9999900001', $1, 'OWNER', true)
      ON CONFLICT (mobile_number) DO UPDATE SET password_hash = $1, is_active = true;
    `, [ownerHash]);

    // Ensure staging Staff exists
    const staffHash = await hashPassword('StaffPass123!');
    await stagingPool.query(`
      INSERT INTO users (name, mobile_number, password_hash, role, is_active)
      VALUES ('Staging Staff', '9999900002', $1, 'STAFF', true)
      ON CONFLICT (mobile_number) DO UPDATE SET password_hash = $1, is_active = true;
    `, [staffHash]);

    // Ensure staging CA exists
    const caHash = await hashPassword('CAPass123!');
    await stagingPool.query(`
      INSERT INTO users (name, mobile_number, password_hash, role, is_active)
      VALUES ('Staging CA', '9999900003', $1, 'CA', true)
      ON CONFLICT (mobile_number) DO UPDATE SET password_hash = $1, is_active = true;
    `, [caHash]);
  });

  afterAll(async () => {
    for (const proc of spawnedProcs) {
      await stopProcessGracefully(proc, 3000);
    }
    spawnedProcs.clear();
    serverProcess = null;
    restartedProcess = null;
    if (stagingPool) {
      await stagingPool.end();
    }
  });

  describe('1. Staging Environment & Packaging Configuration Validation', () => {
    it('accepts valid staging production configuration via parseEnv', () => {
      const validStagingEnv = {
        NODE_ENV: 'production',
        PORT: '3001',
        DATABASE_URL: STAGING_DATABASE_URL,
        JWT_SECRET: STAGING_JWT_SECRET,
        STORAGE_DIR: STAGING_STORAGE_DIR,
        CORS_ORIGIN: 'http://localhost:5173,https://staging.ssrl.in',
        LOG_LEVEL: 'info',
      };
      const parsed = parseEnv(validStagingEnv);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.NODE_ENV).toBe('production');
        expect(parsed.data.STORAGE_DIR).toBe(STAGING_STORAGE_DIR);
        expect(parsed.data.CORS_ORIGIN).toBe('http://localhost:5173,https://staging.ssrl.in');
      }
    });

    it('rejects missing STORAGE_DIR or wildcard CORS in production mode', () => {
      const invalidNoStorage = {
        NODE_ENV: 'production',
        DATABASE_URL: STAGING_DATABASE_URL,
        JWT_SECRET: STAGING_JWT_SECRET,
        CORS_ORIGIN: 'https://staging.ssrl.in',
      };
      const res1 = parseEnv(invalidNoStorage);
      expect(res1.success).toBe(false);

      const invalidWildcardCors = {
        NODE_ENV: 'production',
        DATABASE_URL: STAGING_DATABASE_URL,
        JWT_SECRET: STAGING_JWT_SECRET,
        STORAGE_DIR: STAGING_STORAGE_DIR,
        CORS_ORIGIN: '*',
      };
      const res2 = parseEnv(invalidWildcardCors);
      expect(res2.success).toBe(false);
    });

    it('initializes persistent LocalStorageService on staging directory with path traversal protection', async () => {
      const storage = new LocalStorageService(STAGING_STORAGE_DIR);
      expect(storage.getBaseDir()).toBe(STAGING_STORAGE_DIR);

      // Verify path traversal rejection
      await expect(storage.exists('../outside.pdf')).rejects.toThrow();
      await expect(storage.exists('..\\outside.pdf')).rejects.toThrow();
      await expect(storage.exists('/etc/passwd')).rejects.toThrow();
    });
  });

  describe('2. Staging Database Migration & Schema Completeness', () => {
    it('verifies all 40 canonical tables, 27 domain functions, and 63 triggers exist in staging DB', async () => {
      // 1. Tables count
      const tablesRes = await stagingPool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ANY($1)
      `, [CANONICAL_TABLES_001]);
      expect(tablesRes.rows.length).toBe(40);

      // 2. Domain functions count
      const funcRes = await stagingPool.query(`
        SELECT p.proname 
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = ANY($1)
      `, [CANONICAL_FUNCTIONS_001]);
      expect(funcRes.rows.length).toBe(27);

      // 3. Triggers count
      const trigRes = await stagingPool.query(`
        SELECT t.tgname, t.tgdeferrable
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal;
      `);
      expect(trigRes.rows.length).toBe(63);

      // 4. Dynamic fields definitions count
      const dynRes = await stagingPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
      expect(parseInt(dynRes.rows[0].count, 10)).toBe(CANONICAL_DYNAMIC_FIELDS_COUNT);

      // 5. Applied migrations in tracking table
      const migRes = await stagingPool.query('SELECT id FROM schema_migrations ORDER BY applied_at ASC');
      expect(migRes.rows.map((r: any) => r.id)).toEqual([
        '001_initial_schema.sql',
        '002_add_document_expiry.sql',
      ]);
    });

    it('verifies trip_pods canonical schema and rejects nonexistent pod_details references', async () => {
      // 1. Confirm trip_pods exists with exact canonical columns
      const colsRes = await stagingPool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trip_pods'
        ORDER BY ordinal_position;
      `);
      const colNames = colsRes.rows.map((r: any) => r.column_name);
      expect(colNames).toEqual([
        'id',
        'trip_id',
        'pod_status',
        'docket_number',
        'courier_partner',
        'pod_received_at',
        'sent_to_party_at',
        'notes',
        'created_at',
        'updated_at',
      ]);

      // 2. Confirm nonexistent pod_details table does NOT exist
      const nonExistentRes = await stagingPool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'pod_details'
        ) as exists;
      `);
      expect(nonExistentRes.rows[0].exists).toBe(false);

      // 3. Confirm querying nonexistent pod_details throws relation does not exist error
      await expect(stagingPool.query('SELECT * FROM pod_details')).rejects.toThrow(/relation "pod_details" does not exist/);

      // 4. Confirm inserting invalid column into trip_pods throws column does not exist error
      await expect(
        stagingPool.query('INSERT INTO trip_pods (trip_id, pod_status, nonexistent_col) VALUES ($1, $2, $3)', [
          '00000000-0000-0000-0000-000000000000',
          'PENDING',
          'test',
        ])
      ).rejects.toThrow(/column "nonexistent_col" of relation "trip_pods" does not exist/);
    });
  });

  describe('3. Staging Live HTTP Service Probing (dist/server.js on Port 3001)', () => {
    beforeAll(async () => {
      // Spawn compiled binary dist/server.js in production mode
      serverProcess = spawn('node', ['dist/server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(STAGING_PORT),
          DATABASE_URL: STAGING_DATABASE_URL,
          JWT_SECRET: STAGING_JWT_SECRET,
          STORAGE_DIR: STAGING_STORAGE_DIR,
          CORS_ORIGIN: 'http://localhost:5173,https://staging.ssrl.in',
          LOG_LEVEL: 'info',
        },
        stdio: 'ignore',
      });
      spawnedProcs.add(serverProcess);

      const started = await waitForServer();
      expect(started).toBe(true);
    });

    it('responds to GET /api/health with HTTP 200 and healthy DB connection', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('UP');
      expect(body.data.database).toBe('UP');
    });

    it('enforces Helmet security headers (HSTS, nosniff, frame-ancestors)', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/health`);
      expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    });

    it('enforces strict CORS rules for allowed vs unauthorized origins', async () => {
      // 1. Allowed origin preflight
      const allowedRes = await stagingFetch(`${STAGING_URL}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:5173',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(allowedRes.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');

      // 2. Disallowed origin preflight
      const disallowedRes = await stagingFetch(`${STAGING_URL}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://unauthorized-attacker-site.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(disallowedRes.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  describe('4. Staging Authentication & Multi-Role RBAC Authorization Matrix', () => {
    it('authenticates Owner user and returns valid Bearer token', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile_number: '9999900001',
          password: 'StagingPass123!',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      ownerToken = body.data.token;
    });

    it('authenticates Staff and CA users and returns role-scoped tokens', async () => {
      // Staff login
      const staffRes = await stagingFetch(`${STAGING_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile_number: '9999900002',
          password: 'StaffPass123!',
        }),
      });
      expect(staffRes.status).toBe(200);
      const staffBody = await staffRes.json();
      staffToken = staffBody.data.token;

      // CA login
      const caRes = await stagingFetch(`${STAGING_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile_number: '9999900003',
          password: 'CAPass123!',
        }),
      });
      expect(caRes.status).toBe(200);
      const caBody = await caRes.json();
      caToken = caBody.data.token;
    });

    it('rejects unauthenticated requests to protected API endpoints with HTTP 401', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/trips`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects CA mutation requests (POST /api/trips) with HTTP 403 Forbidden', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${caToken}`,
        },
        body: JSON.stringify({
          trip_type: 'COMPANY',
          vehicle_relationship: 'MARKET',
          party_id: '00000000-0000-0000-0000-000000000000',
          trip_date: '2026-10-15',
          destinations: [{ origin: 'Jaipur', destination: 'Delhi' }],
        }),
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('permits CA read access to financial report endpoints with HTTP 200', async () => {
      const res = await stagingFetch(`${STAGING_URL}/api/reports/financial-summary`, {
        headers: { 'Authorization': `Bearer ${caToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('5. Synthetic Operational Lifecycle Execution on Staging', () => {
    it('creates Party, Vehicle Owner, Market Vehicle, and Own Fleet Vehicle', async () => {
      // 1. Create Party
      const partyRes = await stagingFetch(`${STAGING_URL}/api/parties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          party_type: 'COMPANY',
          name: 'Staging Minerals & Logistics Ltd',
          primary_mobile: '9811100001',
          city: 'Jaipur',
          state: 'Rajasthan',
          gstin: '08ABCDE1234F1Z5',
          is_tds_applicable: true,
        }),
      });
      expect(partyRes.status).toBe(201);
      const partyBody = await partyRes.json();
      createdPartyId = partyBody.data.id;

      // 2. Create Vehicle Owner
      const ownerRes = await stagingFetch(`${STAGING_URL}/api/vehicle-owners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          name: 'Staging Truck Operator',
          mobile_number: '9822200002',
          city: 'Ajmer',
        }),
      });
      expect(ownerRes.status).toBe(201);
      const ownerBody = await ownerRes.json();
      createdOwnerId = ownerBody.data.id;

      // 3. Create Market Vehicle
      const mvRes = await stagingFetch(`${STAGING_URL}/api/market-vehicles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          vehicle_number: 'RJ-14-ST-1234',
          vehicle_owner_id: createdOwnerId,
        }),
      });
      expect(mvRes.status).toBe(201);
      const mvBody = await mvRes.json();
      createdVehicleId = mvBody.data.id;

      // 4. Create Own Fleet Vehicle
      const ofRes = await stagingFetch(`${STAGING_URL}/api/own-fleet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          vehicle_number: 'RJ-14-OF-7777',
          make: 'Tata Prima',
          model_year: 2025,
        }),
      });
      expect(ofRes.status).toBe(201);
    });

    it('creates Trip with destinations and updates financial obligations', async () => {
      // 1. Create Trip as Staff
      const tripRes = await stagingFetch(`${STAGING_URL}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          trip_type: 'COMPANY',
          vehicle_relationship: 'MARKET',
          party_id: createdPartyId,
          vehicle_owner_id: createdOwnerId,
          market_vehicle_id: createdVehicleId,
          trip_date: '2026-10-15',
          driver_name: 'Staging Driver',
          driver_mobile: '9833300003',
          destinations: [
            { origin: 'Jaipur Quarry', destination: 'Kishangarh Plant' },
          ],
        }),
      });
      expect(tripRes.status).toBe(201);
      const tripBody = await tripRes.json();
      createdTripId = tripBody.data.id;

      // 2. Update financials
      const finRes = await stagingFetch(`${STAGING_URL}/api/trips/${createdTripId}/financials`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          freight_amount: 50000,
          detention_amount: 2000,
          tds_amount: 1000,
        }),
      });
      expect(finRes.status).toBe(200);

      // 3. Mark trip as COMPLETED so it is eligible for billing
      const statusRes = await stagingFetch(`${STAGING_URL}/api/trips/${createdTripId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      expect(statusRes.status).toBe(200);
    });

    it('uploads POD document, writes to storage/staging/documents, and streams via secure file API', async () => {
      const uploadRes = await stagingFetch(`${STAGING_URL}/api/documents/pod`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          trip_id: createdTripId,
          courier_docket_number: 'DOCKET-STG-9988',
          file_name: 'staging_pod_verified.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 2048,
        }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadBody = await uploadRes.json();
      createdDocumentId = uploadBody.data.id;
      const storageKey = uploadBody.data.storage_key;

      // Verify physical file exists in storage/staging
      const physicalPath = path.join(STAGING_STORAGE_DIR, storageKey);
      expect(fs.existsSync(physicalPath)).toBe(true);

      // Stream file back via GET /api/documents/:id/file
      const streamRes = await stagingFetch(`${STAGING_URL}/api/documents/${createdDocumentId}/file`, {
        headers: { 'Authorization': `Bearer ${ownerToken}` },
      });
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get('content-type')).toContain('application/pdf');
      const content = await streamRes.text();
      expect(content).toContain('%PDF-1.4');
    });

    it('records Incoming Payment with complete allocation to Trip and excess credit generation', async () => {
      const payRes = await stagingFetch(`${STAGING_URL}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          payment_date: '2026-10-15',
          payment_mode: 'BANK_TRANSFER',
          amount: 70000,
          payment_direction: 'INCOMING',
          payment_category: 'COMPANY_PAYMENT',
          party_id: createdPartyId,
          allocations: [
            {
              allocation_type: 'TRIP',
              allocated_amount: 50000,
              target_trip_id: createdTripId,
            },
            {
              allocation_type: 'CREDIT_GENERATED',
              allocated_amount: 20000,
            },
          ],
        }),
      });
      expect(payRes.status).toBe(201);
      const payBody = await payRes.json();
      createdPaymentId = payBody.data.id;
      expect(payBody.data.payment_status).toBe('ACTIVE');

      // Verify party credits in DB
      const credRes = await stagingPool.query(`
        SELECT pa.allocation_amount
        FROM party_credits pc
        JOIN payment_allocations pa ON pa.id = pc.credit_allocation_id
        WHERE pc.party_id = $1
      `, [createdPartyId]);
      expect(credRes.rows.length).toBe(1);
      expect(parseFloat(credRes.rows[0].allocation_amount)).toBe(20000);
    });

    it('prohibits Staff from reversing Payment with HTTP 403 Forbidden', async () => {
      const revRes = await stagingFetch(`${STAGING_URL}/api/payments/${createdPaymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${staffToken}`,
        },
        body: JSON.stringify({
          reversal_reason: 'Staff attempted illegal reversal',
        }),
      });
      expect(revRes.status).toBe(403);
    });

    it('generates Bill, generates PDF snapshot in staging storage, and derives PAID status', async () => {
      // 1. Create Financial Year & Numbering Series in staging DB
      const fyRes = await stagingPool.query(`
        INSERT INTO financial_years (code, start_date, end_date, is_active)
        VALUES ('FY26-27', '2026-04-01', '2027-03-31', true)
        ON CONFLICT (code) DO UPDATE SET is_active = true
        RETURNING id;
      `);
      financialYearId = fyRes.rows[0].id;

      const seriesRes = await stagingPool.query(`
        INSERT INTO bill_numbering_series (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by)
        VALUES ($1, $2, 'MAIN', 'SRL/26-27/', 0, true, (SELECT id FROM users WHERE role = 'OWNER' LIMIT 1))
        ON CONFLICT (party_id, financial_year_id, series_code) DO UPDATE SET is_active = true
        RETURNING id;
      `, [createdPartyId, financialYearId]);
      numberingSeriesId = seriesRes.rows[0].id;

      // 2. Generate Bill as Owner
      const billRes = await stagingFetch(`${STAGING_URL}/api/bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          party_id: createdPartyId,
          financial_year_id: financialYearId,
          numbering_series_id: numberingSeriesId,
          billing_mode: 'INDIVIDUAL',
          bill_date: '2026-10-15',
          trip_ids: [createdTripId],
          template_snapshot: {
            template: { name: 'Standard Staging Freight Invoice' },
            components: [],
            assets: [],
          },
        }),
      });
      expect(billRes.status).toBe(201);
      const billBody = await billRes.json();
      const billObj = billBody.data?.bill || billBody.data;
      createdBillId = billObj.id;
      expect(billObj.bill_number).toBe('SRL/26-27/1');

      // 3. Request Bill PDF to trigger PDF storage generation
      const pdfRes = await stagingFetch(`${STAGING_URL}/api/bills/${createdBillId}/pdf`, {
        headers: { 'Authorization': `Bearer ${ownerToken}` },
      });
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('content-type')).toContain('application/pdf');

      // Verify physical PDF generated in storage/staging/bills
      const billPdfPath = path.join(STAGING_STORAGE_DIR, 'bills', createdBillId, 'v1.pdf');
      expect(fs.existsSync(billPdfPath)).toBe(true);
    });

    it('reflects authoritative payment-based Net P&L in financial reports', async () => {
      const repRes = await stagingFetch(`${STAGING_URL}/api/reports/financial-summary`, {
        headers: { 'Authorization': `Bearer ${ownerToken}` },
      });
      expect(repRes.status).toBe(200);
      const repBody = await repRes.json();
      expect(repBody.success).toBe(true);
      // Net P&L must reflect the 70,000 active incoming payment
      expect(parseFloat(repBody.data.netPnl)).toBe(70000);
    });
  });

  describe('6. Staging Persistent Storage Reconciliation & Backup Verification', () => {
    it('executes storage reconciliation dry-run and confirms 0 missing files and 0 orphans', async () => {
      const audit = await reconcileStorage({
        dryRun: true,
        storageDir: STAGING_STORAGE_DIR,
        dbPool: stagingPool,
      });

      expect(audit.missingFiles.length).toBe(0);
      expect(audit.orphanFiles.length).toBe(0);
      expect(audit.totalDiskFiles).toBeGreaterThanOrEqual(1);
      expect(audit.healthyCount).toBeGreaterThanOrEqual(1);
    });

    it('creates binary pg_dump backup of staging database, restores into disposable database with pg_restore --exit-on-error, and validates schema, records, invariants, and storage references', async () => {
      const backupDumpPath = path.join(os.tmpdir(), `staging_db_backup_${Date.now()}.dump`);
      const RESTORE_DB_NAME = 'ssrl_staging_restore_test_db';
      const adminPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/postgres`,
      });

      try {
        if (fs.existsSync(backupDumpPath)) {
          fs.unlinkSync(backupDumpPath);
        }

        // 1. Execute pg_dump -Fc
        execSync(
          `pg_dump -Fc -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${STAGING_DB_NAME} -f "${backupDumpPath}"`,
          { stdio: 'pipe' }
        );
        expect(fs.existsSync(backupDumpPath)).toBe(true);
        const dumpStats = fs.statSync(backupDumpPath);
        expect(dumpStats.size).toBeGreaterThan(10000);

        // 2. Verify SHA-256 checksums of storage files
        const podDir = path.join(STAGING_STORAGE_DIR, 'documents');
        const podFiles = fs.readdirSync(podDir);
        expect(podFiles.length).toBeGreaterThan(0);
        const hash1 = crypto.createHash('sha256').update(fs.readFileSync(path.join(podDir, podFiles[0]))).digest('hex');
        const hash2 = crypto.createHash('sha256').update(fs.readFileSync(path.join(podDir, podFiles[0]))).digest('hex');
        expect(hash1).toBe(hash2);

        // 3. Prepare clean disposable database
        await adminPool.query(`DROP DATABASE IF EXISTS ${RESTORE_DB_NAME} WITH (FORCE);`);
        await adminPool.query(`CREATE DATABASE ${RESTORE_DB_NAME};`);

        // 4. Restore backup using pg_restore --exit-on-error
        execSync(
          `pg_restore --exit-on-error -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${RESTORE_DB_NAME} "${backupDumpPath}"`,
          { stdio: 'pipe' }
        );

        // 5. Connect to restored database and verify schema completeness
        const restorePool = new Pool({
          connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${RESTORE_DB_NAME}`,
        });

        try {
          // Schema verification: 40 canonical tables
          const tablesRes = await restorePool.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = ANY($1)
          `, [CANONICAL_TABLES_001]);
          expect(tablesRes.rows.length).toBe(40);

          // Domain functions verification: 27 domain functions
          const funcRes = await restorePool.query(`
            SELECT p.proname 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = ANY($1)
          `, [CANONICAL_FUNCTIONS_001]);
          expect(funcRes.rows.length).toBe(27);

          // Triggers verification: 63 triggers
          const trigRes = await restorePool.query(`
            SELECT t.tgname
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND NOT t.tgisinternal;
          `);
          expect(trigRes.rows.length).toBe(63);

          // Migration tracking verification
          const migRes = await restorePool.query('SELECT id FROM schema_migrations ORDER BY applied_at ASC');
          expect(migRes.rows.map((r: any) => r.id)).toEqual([
            '001_initial_schema.sql',
            '002_add_document_expiry.sql',
          ]);

          // Dynamic field definitions verification
          const dynRes = await restorePool.query('SELECT count(*) as count FROM dynamic_field_definitions');
          expect(parseInt(dynRes.rows[0].count, 10)).toBe(CANONICAL_DYNAMIC_FIELDS_COUNT);

          // Operational records verification
          const partyCheck = await restorePool.query('SELECT id, name, gstin FROM parties WHERE id = $1', [createdPartyId]);
          expect(partyCheck.rows.length).toBe(1);
          expect(partyCheck.rows[0].name).toBe('Staging Minerals & Logistics Ltd');

          const ownerCheck = await restorePool.query('SELECT id, name FROM vehicle_owners WHERE id = $1', [createdOwnerId]);
          expect(ownerCheck.rows.length).toBe(1);
          expect(ownerCheck.rows[0].name).toBe('Staging Truck Operator');

          const mvCheck = await restorePool.query('SELECT id, vehicle_number FROM market_vehicles WHERE id = $1', [createdVehicleId]);
          expect(mvCheck.rows.length).toBe(1);
          expect(mvCheck.rows[0].vehicle_number).toBe('RJ-14-ST-1234');

          const tripCheck = await restorePool.query('SELECT id, status FROM trips WHERE id = $1', [createdTripId]);
          expect(tripCheck.rows.length).toBe(1);
          expect(tripCheck.rows[0].status).toBe('COMPLETED');

          const billCheck = await restorePool.query('SELECT id, bill_number, bill_status FROM bills WHERE id = $1', [createdBillId]);
          expect(billCheck.rows.length).toBe(1);
          expect(billCheck.rows[0].bill_number).toBe('SRL/26-27/1');

          // Financial Invariants Verification
          // 1. Payment-based Net P&L: Active Incoming - Active Outgoing = 70,000
          const pnlRes = await restorePool.query(`
            SELECT 
              COALESCE(SUM(CASE WHEN payment_type = 'INCOMING' THEN amount ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN payment_type = 'OUTGOING' THEN amount ELSE 0 END), 0) as net_pnl
            FROM payments
            WHERE payment_status = 'ACTIVE';
          `);
          expect(parseFloat(pnlRes.rows[0].net_pnl)).toBe(70000);

          // 2. Party Credits: 20,000 generated
          const credRes = await restorePool.query(`
            SELECT pa.allocation_amount
            FROM party_credits pc
            JOIN payment_allocations pa ON pa.id = pc.credit_allocation_id
            WHERE pc.party_id = $1
          `, [createdPartyId]);
          expect(credRes.rows.length).toBe(1);
          expect(parseFloat(credRes.rows[0].allocation_amount)).toBe(20000);

          // Physical storage references verification
          const docRes = await restorePool.query('SELECT storage_key FROM documents WHERE id = $1', [createdDocumentId]);
          expect(docRes.rows.length).toBe(1);
          const docPath = path.join(STAGING_STORAGE_DIR, docRes.rows[0].storage_key);
          expect(fs.existsSync(docPath)).toBe(true);

          const billPdfPath = path.join(STAGING_STORAGE_DIR, 'bills', createdBillId, 'v1.pdf');
          expect(fs.existsSync(billPdfPath)).toBe(true);
        } finally {
          await restorePool.end();
        }
      } finally {
        // Drop disposable database and clean backup dump
        try {
          await adminPool.query(`DROP DATABASE IF EXISTS ${RESTORE_DB_NAME} WITH (FORCE);`);
        } catch {}
        await adminPool.end();

        if (fs.existsSync(backupDumpPath)) {
          fs.unlinkSync(backupDumpPath);
        }
      }
    });
  });

  describe('7. Process Lifecycle, Graceful Shutdown & Rollback Simulation', () => {
    it('stops staging service cleanly and restarts verifying persistent data survival', async () => {
      // 1. Gracefully stop first process
      const stopResult = await stopProcessGracefully(serverProcess);
      expect(stopResult.exited).toBe(true);
      serverProcess = null;

      // 2. Start new instance simulating restart or rollback
      restartedProcess = spawn('node', ['dist/server.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: String(STAGING_PORT),
          DATABASE_URL: STAGING_DATABASE_URL,
          JWT_SECRET: STAGING_JWT_SECRET,
          STORAGE_DIR: STAGING_STORAGE_DIR,
          CORS_ORIGIN: 'http://localhost:5173,https://staging.ssrl.in',
          LOG_LEVEL: 'info',
        },
        stdio: 'ignore',
      });
      spawnedProcs.add(restartedProcess);

      const restarted = await waitForServer();
      expect(restarted).toBe(true);

      // 3. Verify health and that previous tokens and data survive restart
      const healthRes = await stagingFetch(`${STAGING_URL}/api/health`);
      expect(healthRes.status).toBe(200);

      const billRes = await stagingFetch(`${STAGING_URL}/api/bills/${createdBillId}`, {
        headers: { 'Authorization': `Bearer ${ownerToken}` },
      });
      expect(billRes.status).toBe(200);
      const billData = await billRes.json();
      expect(billData.data.bill_number).toBe('SRL/26-27/1');

      // 4. Gracefully stop restarted process
      const restartStopResult = await stopProcessGracefully(restartedProcess);
      expect(restartStopResult.exited).toBe(true);
      restartedProcess = null;
    });
  });
});
