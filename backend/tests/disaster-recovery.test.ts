import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { LocalStorageService } from '../src/services/storage.service';
import { reconcileStorage } from '../src/scripts/reconcile-storage';
import {
  runMigrations,
  CANONICAL_TABLES_001,
  CANONICAL_FUNCTIONS_001,
  CANONICAL_TRIGGERS_COUNT_001,
  CANONICAL_DYNAMIC_FIELDS_COUNT,
} from '../src/scripts/migrate';
import { hashPassword } from '../src/modules/auth/auth.service';

const PG_HOST = process.env.DB_HOST || 'localhost';
const PG_PORT = process.env.DB_PORT || '5432';
const PG_USER = process.env.DB_USER || 'postgres';

function runPsql(db: string, sql: string) {
  return execSync(`psql -v ON_ERROR_STOP=1 -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${db} -c "${sql}"`, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

function runPsqlFile(db: string, filePath: string) {
  return execSync(`psql -v ON_ERROR_STOP=1 -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${db} -f "${filePath}"`, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

describe('Phase 4P-C.1: Disaster Recovery, Backup & Restore Validation Suite', () => {
  jest.setTimeout(90000);

  const DB_SOURCE = 'ssrl_dr_source_test';
  const DB_TARGET = 'ssrl_dr_target_test';
  const DB_CLEAN = 'ssrl_clean_mig_test';
  const DB_PARTIAL = 'ssrl_partial_mig_test';
  const DB_BASELINE = 'ssrl_baseline_test';
  const DB_MISSING_OBJ = 'ssrl_missing_obj_test';
  const DB_FAILED_MIG = 'ssrl_failed_mig_test';
  const DB_SEED_TEST = 'ssrl_seed_test';

  let tempDir: string;
  let sourceStorageDir: string;
  let targetStorageDir: string;
  let backupDumpPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssrl-dr-validation-'));
    sourceStorageDir = path.join(tempDir, 'source_storage');
    targetStorageDir = path.join(tempDir, 'target_storage');
    backupDumpPath = path.join(tempDir, 'ssrl_source.dump');

    fs.mkdirSync(sourceStorageDir, { recursive: true });
    fs.mkdirSync(targetStorageDir, { recursive: true });

    // Clean up any stale test databases
    for (const db of [
      DB_SOURCE,
      DB_TARGET,
      DB_CLEAN,
      DB_PARTIAL,
      DB_BASELINE,
      DB_MISSING_OBJ,
      DB_FAILED_MIG,
      DB_SEED_TEST,
    ]) {
      try {
        runPsql('postgres', `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
      } catch {}
    }
  }, 60000);

  afterAll(() => {
    // Drop all temporary test databases
    for (const db of [
      DB_SOURCE,
      DB_TARGET,
      DB_CLEAN,
      DB_PARTIAL,
      DB_BASELINE,
      DB_MISSING_OBJ,
      DB_FAILED_MIG,
      DB_SEED_TEST,
    ]) {
      try {
        runPsql('postgres', `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
      } catch {}
    }

    // Clean temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 60000);

  describe('1. Migration Runner Safety & Baselining Verification', () => {
    it('applies migrations cleanly and seeds canonical dynamic fields on a fresh database', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_CLEAN} OWNER ${PG_USER};`);

      const cleanPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_CLEAN}`,
      });

      try {
        // Execute runMigrations on fresh empty database
        const result = await runMigrations(cleanPool);
        expect(result.newlyAppliedCount).toBe(2);

        // Verify migrations tracked
        const migRes = await cleanPool.query('SELECT id FROM schema_migrations ORDER BY id ASC');
        expect(migRes.rows.map((r: any) => r.id)).toEqual(['001_initial_schema.sql', '002_add_document_expiry.sql']);

        // Verify dynamic fields count
        const dynamicCountRes = await cleanPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
        expect(parseInt(dynamicCountRes.rows[0].count, 10)).toBe(CANONICAL_DYNAMIC_FIELDS_COUNT);

        // Verify documents table has expiry_date column
        const colRes = await cleanPool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = 'documents' AND column_name = 'expiry_date'
        `);
        expect(colRes.rows.length).toBe(1);
        expect(colRes.rows[0].data_type).toBe('date');
      } finally {
        await cleanPool.end();
      }
    });

    it('baselines cleanly on fully initialized existing database and does not re-apply migrations', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_BASELINE} OWNER ${PG_USER};`);

      const baselinePool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_BASELINE}`,
      });

      try {
        // Apply full schema files directly via psql to simulate pre-existing database without schema_migrations
        const migrationsDir = path.resolve(__dirname, '../../database/migrations');
        runPsqlFile(DB_BASELINE, path.join(migrationsDir, '001_initial_schema.sql'));
        runPsqlFile(DB_BASELINE, path.join(migrationsDir, '002_add_document_expiry.sql'));

        // Now run runMigrations - it must detect complete 40-table schema, baseline both, and apply 0 new
        const result = await runMigrations(baselinePool);
        expect(result.newlyAppliedCount).toBe(0);

        const migRes = await baselinePool.query('SELECT id FROM schema_migrations ORDER BY id ASC');
        expect(migRes.rows.map((r: any) => r.id)).toEqual(['001_initial_schema.sql', '002_add_document_expiry.sql']);
      } finally {
        await baselinePool.end();
      }
    });

    it('rejects automatic baselining when database schema is partially initialized (missing tables)', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_PARTIAL} OWNER ${PG_USER};`);

      const partialPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_PARTIAL}`,
      });

      try {
        // Manually create pgcrypto and ONLY users and parties tables (simulating incomplete schema)
        await partialPool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
        await partialPool.query(`
          CREATE TABLE users (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            mobile_number VARCHAR(20) NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role VARCHAR(20) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true
          );
          CREATE TABLE parties (
            id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            primary_mobile VARCHAR(20) NOT NULL,
            party_type VARCHAR(30) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT true
          );
        `);

        // Attempting to run migrate on this database must detect missing tables and fail
        await expect(runMigrations(partialPool)).rejects.toThrow(
          /Incomplete database schema detected \(found 2\/40 tables; missing:/
        );
      } finally {
        await partialPool.end();
      }
    });

    it('rejects automatic baselining when all tables exist but required domain functions or triggers are missing', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_MISSING_OBJ} OWNER ${PG_USER};`);

      const missingObjPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_MISSING_OBJ}`,
      });

      try {
        // Load initial schema
        const migrationsDir = path.resolve(__dirname, '../../database/migrations');
        runPsqlFile(DB_MISSING_OBJ, path.join(migrationsDir, '001_initial_schema.sql'));

        // Intentionally drop a required domain function and its dependent triggers
        await missingObjPool.query('DROP FUNCTION recalculate_bill(UUID) CASCADE;');

        // Run migrations on this damaged schema without migration history: must refuse to baseline!
        await expect(runMigrations(missingObjPool)).rejects.toThrow(
          /Incomplete database schema detected: missing 1 required domain function\(s\) \(recalculate_bill\)/
        );
      } finally {
        await missingObjPool.end();
      }
    });

    it('rolls back atomic transaction and does not record migration if SQL execution fails', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_FAILED_MIG} OWNER ${PG_USER};`);

      const failedMigPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_FAILED_MIG}`,
      });

      try {
        // Initialize schema_migrations
        await failedMigPool.query(`
          CREATE TABLE schema_migrations (
            id VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `);

        // Simulate migration runner executing an invalid migration
        const client = await failedMigPool.connect();
        try {
          let errorCaught = false;
          await client.query('BEGIN');
          try {
            await client.query('CREATE TABLE valid_table (id INT PRIMARY KEY);');
            // Intentional syntax error
            await client.query('THIS IS AN INVALID SQL STATEMENT THAT WILL FAIL;');
            await client.query("INSERT INTO schema_migrations (id) VALUES ('999_failing_migration.sql');");
            await client.query('COMMIT');
          } catch (e) {
            await client.query('ROLLBACK');
            errorCaught = true;
          }
          expect(errorCaught).toBe(true);

          // Confirm neither the table nor the migration record were committed
          const tableCheck = await client.query(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'valid_table'"
          );
          expect(tableCheck.rows.length).toBe(0);

          const migCheck = await client.query(
            "SELECT 1 FROM schema_migrations WHERE id = '999_failing_migration.sql'"
          );
          expect(migCheck.rows.length).toBe(0);
        } finally {
          client.release();
        }
      } finally {
        await failedMigPool.end();
      }
    });

    it('transactionally completes partial dynamic field definitions and is safely idempotent', async () => {
      runPsql('postgres', `CREATE DATABASE ${DB_SEED_TEST} OWNER ${PG_USER};`);

      const seedPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_SEED_TEST}`,
      });

      try {
        // Set up fresh schema with clean migrations
        await runMigrations(seedPool);

        // Intentionally delete some dynamic fields to simulate partial / interrupted seeding (e.g. 10 remain)
        await seedPool.query(`
          DELETE FROM dynamic_field_definitions 
          WHERE id NOT IN (SELECT id FROM dynamic_field_definitions LIMIT 10);
        `);

        const partialCount = await seedPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
        expect(parseInt(partialCount.rows[0].count, 10)).toBe(10);

        // Re-running runMigrations must detect < 86 fields, apply canonical seed transactionally, and reach 86
        await runMigrations(seedPool);

        const restoredCount = await seedPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
        expect(parseInt(restoredCount.rows[0].count, 10)).toBe(CANONICAL_DYNAMIC_FIELDS_COUNT);

        // Run again to confirm idempotency (should remain 86)
        await runMigrations(seedPool);
        const repeatCount = await seedPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
        expect(parseInt(repeatCount.rows[0].count, 10)).toBe(CANONICAL_DYNAMIC_FIELDS_COUNT);
      } finally {
        await seedPool.end();
      }
    });
  });

  describe('2. Comprehensive Synthetic Data Backup & Restoration (pg_dump / pg_restore)', () => {
    let sourcePool: Pool;
    let targetPool: Pool;

    let sourceCounts: Record<string, number> = {};
    let targetCounts: Record<string, number> = {};

    let sourceNetPnl: number = 0;
    let targetNetPnl: number = 0;

    let measuredDumpMs: number = 0;
    let measuredRestoreMs: number = 0;

    beforeAll(async () => {
      // 1. Create source and target databases
      runPsql('postgres', `CREATE DATABASE ${DB_SOURCE} OWNER ${PG_USER};`);
      runPsql('postgres', `CREATE DATABASE ${DB_TARGET} OWNER ${PG_USER};`);

      sourcePool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_SOURCE}`,
      });
      targetPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_TARGET}`,
      });

      // 2. Initialize source schema
      const migrationsDir = path.resolve(__dirname, '../../database/migrations');
      const seedPath = path.resolve(__dirname, '../../database/seed/dynamic_fields.seed.sql');

      runPsqlFile(DB_SOURCE, path.join(migrationsDir, '001_initial_schema.sql'));
      runPsqlFile(DB_SOURCE, path.join(migrationsDir, '002_add_document_expiry.sql'));
      runPsqlFile(DB_SOURCE, seedPath);

      // Track migrations in source
      await sourcePool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        INSERT INTO schema_migrations (id) VALUES ('001_initial_schema.sql'), ('002_add_document_expiry.sql');
      `);

      // 3. Populate source database with synthetic transport & financial records
      const passwordHash = await hashPassword('AdminPassword123');

      // Users
      const ownerRes = await sourcePool.query(
        `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
         VALUES ('DR Owner', '9811111111', $1, 'OWNER', true) RETURNING id`,
        [passwordHash]
      );
      const staffRes = await sourcePool.query(
        `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
         VALUES ('DR Staff', '9822222222', $1, 'STAFF', true) RETURNING id`,
        [passwordHash]
      );
      const caRes = await sourcePool.query(
        `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
         VALUES ('DR CA', '9833333333', $1, 'CA', true) RETURNING id`,
        [passwordHash]
      );
      const ownerId = ownerRes.rows[0].id;
      const staffId = staffRes.rows[0].id;

      // Financial Year
      const fyRes = await sourcePool.query(
        `INSERT INTO financial_years (code, start_date, end_date, is_active)
         VALUES ('2026-27', '2026-04-01', '2027-03-31', true) RETURNING id`
      );
      const fyId = fyRes.rows[0].id;

      // Parties
      const party1Res = await sourcePool.query(
        `INSERT INTO parties (name, primary_mobile, party_type, billing_address, tds_applicable, is_active)
         VALUES ('UltraTech Cement Ltd', '9844444444', 'COMPANY', 'Mumbai, India', true, true)
         RETURNING id`
      );
      const party2Res = await sourcePool.query(
        `INSERT INTO parties (name, primary_mobile, party_type, tds_applicable, is_active)
         VALUES ('Rajasthan Traders', '9855555555', 'MARKET_PARTY', false, true)
         RETURNING id`
      );
      const party1Id = party1Res.rows[0].id;
      const party2Id = party2Res.rows[0].id;

      // Numbering Series
      const seriesRes = await sourcePool.query(
        `INSERT INTO bill_numbering_series (party_id, financial_year_id, series_code, prefix, current_number, is_active, created_by)
         VALUES ($1, $2, 'STANDARD', 'SRL/26-27/', 2, true, $3) RETURNING id`,
        [party1Id, fyId, staffId]
      );
      const seriesId = seriesRes.rows[0].id;

      // Vehicle Owner & Market Vehicle
      const ownerVehicleRes = await sourcePool.query(
        `INSERT INTO vehicle_owners (name, mobile_number, is_active)
         VALUES ('Ramesh Chand', '9866666666', true) RETURNING id`
      );
      const vehicleOwnerId = ownerVehicleRes.rows[0].id;

      const marketVehRes = await sourcePool.query(
        `INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id, is_active)
         VALUES ('RJ14GB1234', $1, true) RETURNING id`,
        [vehicleOwnerId]
      );
      const marketVehId = marketVehRes.rows[0].id;

      // Own Fleet Vehicle
      const ownFleetVehRes = await sourcePool.query(
        `INSERT INTO own_fleet_vehicles (vehicle_number, is_active)
         VALUES ('RJ14AB9999', true) RETURNING id`
      );
      const ownFleetVehId = ownFleetVehRes.rows[0].id;

      // Trips
      // Trip 1 (Market)
      const trip1Res = await sourcePool.query(
        `INSERT INTO trips (trip_number, party_id, vehicle_relationship, market_vehicle_id, vehicle_owner_id, trip_type, status, trip_date, created_by)
         VALUES ('TRIP-001', $1, 'MARKET', $2, $3, 'COMPANY', 'COMPLETED', '2026-10-01', $4) RETURNING id`,
        [party1Id, marketVehId, vehicleOwnerId, staffId]
      );
      const trip1Id = trip1Res.rows[0].id;
      await sourcePool.query(
        `INSERT INTO trip_party_financials (trip_id, freight_amount)
         VALUES ($1, 50000)`,
        [trip1Id]
      );
      await sourcePool.query(
        `INSERT INTO trip_vehicle_owner_financials (trip_id, freight_amount)
         VALUES ($1, 40000)`,
        [trip1Id]
      );
      await sourcePool.query(`SELECT recalculate_trip_financials($1)`, [trip1Id]);

      // Trip 2 (Market)
      const trip2Res = await sourcePool.query(
        `INSERT INTO trips (trip_number, party_id, vehicle_relationship, market_vehicle_id, vehicle_owner_id, trip_type, status, trip_date, created_by)
         VALUES ('TRIP-002', $1, 'MARKET', $2, $3, 'COMPANY', 'COMPLETED', '2026-10-02', $4) RETURNING id`,
        [party1Id, marketVehId, vehicleOwnerId, staffId]
      );
      const trip2Id = trip2Res.rows[0].id;
      await sourcePool.query(
        `INSERT INTO trip_party_financials (trip_id, freight_amount)
         VALUES ($1, 30000)`,
        [trip2Id]
      );
      await sourcePool.query(`SELECT recalculate_trip_financials($1)`, [trip2Id]);

      // Trip 3 (Own Fleet)
      const trip3Res = await sourcePool.query(
        `INSERT INTO trips (trip_number, party_id, vehicle_relationship, own_fleet_vehicle_id, trip_type, status, trip_date, created_by)
         VALUES ('TRIP-003', $1, 'OWN_FLEET', $2, 'COMPANY', 'COMPLETED', '2026-10-03', $3) RETURNING id`,
        [party2Id, ownFleetVehId, staffId]
      );
      const trip3Id = trip3Res.rows[0].id;
      await sourcePool.query(
        `INSERT INTO trip_party_financials (trip_id, freight_amount)
         VALUES ($1, 20000)`,
        [trip3Id]
      );
      await sourcePool.query(`SELECT recalculate_trip_financials($1)`, [trip3Id]);

      // Consolidated Bill for Trips 1 & 2 inside a single transaction
      const bClient = await sourcePool.connect();
      let billId: string;
      try {
        await bClient.query('BEGIN');
        const billRes = await bClient.query(
          `INSERT INTO bills (bill_number, party_id, financial_year_id, billing_mode, bill_status, bill_date, created_by)
           VALUES ('SRL/26-27/001', $1, $2, 'CONSOLIDATED', 'GENERATED', '2026-10-05', $3) RETURNING id`,
          [party1Id, fyId, staffId]
        );
        billId = billRes.rows[0].id;

        await bClient.query(
          `INSERT INTO bill_items (bill_id, trip_id, sequence_no, description, line_amount, is_active)
           VALUES 
            ($1, $2, 1, 'Freight for Trip 1', 50000, true),
            ($1, $3, 2, 'Freight for Trip 2', 30000, true)`,
          [billId, trip1Id, trip2Id]
        );

        // Bill Versions (V1 superseded, V2 active)
        await bClient.query(
          `INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_snapshot, header_snapshot, totals_snapshot, document_reference, created_by)
           VALUES ($1, 1, 'V1', 'SUPERSEDED', '{"layout": {}, "components": [], "assets": [], "dynamic_field_definitions": []}'::jsonb, '{}'::jsonb, '{"total": 80000}'::jsonb, 'bills/bill_1/v1.pdf', $2)
           RETURNING id`,
          [billId, staffId]
        );

        const v2Res = await bClient.query(
          `INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_snapshot, header_snapshot, totals_snapshot, document_reference, created_by)
           VALUES ($1, 2, 'V2', 'ACTIVE', '{"layout": {}, "components": [], "assets": [], "dynamic_field_definitions": []}'::jsonb, '{}'::jsonb, '{"total": 80000}'::jsonb, 'bills/bill_1/v2.pdf', $2)
           RETURNING id`,
          [billId, staffId]
        );
        const v2Id = v2Res.rows[0].id;

        // Active version items snapshot (must match active bill_items)
        await bClient.query(
          `INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, line_amount)
           VALUES 
            ($1, $2, 1, 'Freight for Trip 1', 50000),
            ($1, $3, 2, 'Freight for Trip 2', 30000)`,
          [v2Id, trip1Id, trip2Id]
        );

        await bClient.query('COMMIT');
      } catch (e) {
        await bClient.query('ROLLBACK');
        throw e;
      } finally {
        bClient.release();
      }

      // Payments & Allocations
      let pay1Id: string;
      let pay3Id: string;
      let pay4Id: string;

      const pClient = await sourcePool.connect();
      try {
        // Payment 1: Incoming from Party 1 (100,000). 80,000 to Bill 1, 20,000 to Credit
        await pClient.query('BEGIN');
        const p1 = await pClient.query(
          `INSERT INTO payments (payment_id, payment_type, category, payment_mode, payment_date, amount, payment_status, party_id, created_by)
           VALUES ('PAY-001', 'INCOMING', 'COMPANY_PAYMENT', 'BANK_TRANSFER', '2026-10-10', 100000, 'ACTIVE', $1, $2)
           RETURNING id`,
          [party1Id, staffId]
        );
        pay1Id = p1.rows[0].id;

        await pClient.query(
          `INSERT INTO payment_allocations (payment_id, allocation_type, bill_id, allocation_amount, allocation_status, created_by)
           VALUES ($1, 'BILL', $2, 80000, 'ACTIVE', $3)`,
          [pay1Id, billId, staffId]
        );

        const allocCredit = await pClient.query(
          `INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, allocation_status, created_by)
           VALUES ($1, 'CREDIT_GENERATED', 20000, 'ACTIVE', $2) RETURNING id`,
          [pay1Id, staffId]
        );

        await pClient.query(
          `INSERT INTO party_credits (party_id, payment_id, credit_allocation_id)
           VALUES ($1, $2, $3)`,
          [party1Id, pay1Id, allocCredit.rows[0].id]
        );
        await pClient.query('COMMIT');

        // Payment 2: Outgoing to Vehicle Owner (40,000)
        await pClient.query('BEGIN');
        const p2 = await pClient.query(
          `INSERT INTO payments (payment_id, payment_type, category, payment_mode, payment_date, amount, payment_status, vehicle_owner_id, created_by)
           VALUES ('PAY-002', 'OUTGOING', 'VEHICLE_OWNER_PAYMENT', 'BANK_TRANSFER', '2026-10-11', 40000, 'ACTIVE', $1, $2)
           RETURNING id`,
          [vehicleOwnerId, staffId]
        );
        await pClient.query(
          `INSERT INTO payment_allocations (payment_id, allocation_type, vehicle_owner_id, allocation_amount, allocation_status, created_by)
           VALUES ($1, 'VEHICLE_OWNER', $2, 40000, 'ACTIVE', $3)`,
          [p2.rows[0].id, vehicleOwnerId, staffId]
        );
        await pClient.query('COMMIT');

        // Payment 3: Incoming from Party 2 (15,000) allocated to Trip 3
        await pClient.query('BEGIN');
        const p3 = await pClient.query(
          `INSERT INTO payments (payment_id, payment_type, category, payment_mode, payment_date, amount, payment_status, party_id, created_by)
           VALUES ('PAY-003', 'INCOMING', 'MARKET_PARTY_PAYMENT', 'UPI', '2026-10-12', 15000, 'ACTIVE', $1, $2)
           RETURNING id`,
          [party2Id, staffId]
        );
        pay3Id = p3.rows[0].id;
        await pClient.query(
          `INSERT INTO payment_allocations (payment_id, allocation_type, trip_id, allocation_amount, allocation_status, created_by)
           VALUES ($1, 'TRIP', $2, 15000, 'ACTIVE', $3)`,
          [pay3Id, trip3Id, staffId]
        );
        await pClient.query('COMMIT');

        // Payment 4: Reversed Payment (10,000)
        await pClient.query('BEGIN');
        const p4 = await pClient.query(
          `INSERT INTO payments (payment_id, payment_type, category, payment_mode, payment_date, amount, payment_status, party_id, reversal_reason, reversed_by, reversed_at, created_by)
           VALUES ('PAY-004', 'INCOMING', 'COMPANY_PAYMENT', 'BANK_TRANSFER', '2026-10-13', 10000, 'REVERSED', $1, 'Cheque bounced by bank', $2, now(), $3)
           RETURNING id`,
          [party1Id, ownerId, staffId]
        );
        pay4Id = p4.rows[0].id;
        await pClient.query(
          `INSERT INTO payment_allocations (payment_id, allocation_type, trip_id, allocation_amount, allocation_status, reversed_at, created_by)
           VALUES ($1, 'TRIP', $2, 10000, 'REVERSED', now(), $3)`,
          [pay4Id, trip1Id, staffId]
        );
        await pClient.query('COMMIT');
      } finally {
        pClient.release();
      }

      // Documents & Document Links
      const doc1Res = await sourcePool.query(
        `INSERT INTO documents (document_type, original_name, storage_provider, storage_key, file_size_bytes, mime_type, uploaded_by)
         VALUES ('POD', 'pod_trip001.pdf', 'LOCAL', 'documents/pod_trip001.pdf', 1024, 'application/pdf', $1)
         RETURNING id`,
        [staffId]
      );
      await sourcePool.query(
        `INSERT INTO document_links (document_id, entity_type, entity_id)
         VALUES ($1, 'TRIP', $2)`,
        [doc1Res.rows[0].id, trip1Id]
      );

      const doc2Res = await sourcePool.query(
        `INSERT INTO documents (document_type, original_name, storage_provider, storage_key, file_size_bytes, mime_type, expiry_date, uploaded_by)
         VALUES ('FITNESS_CERTIFICATE', 'fitness_trailer.pdf', 'LOCAL', 'documents/fitness_trailer.pdf', 2048, 'application/pdf', '2026-12-31', $1)
         RETURNING id`,
        [staffId]
      );
      await sourcePool.query(
        `INSERT INTO document_links (document_id, entity_type, entity_id)
         VALUES ($1, 'OWN_FLEET_VEHICLE', $2)`,
        [doc2Res.rows[0].id, ownFleetVehId]
      );

      // Audit Events
      await sourcePool.query(
        `INSERT INTO audit_events (actor_user_id, action_type, module_name, entity_type, entity_id)
         VALUES 
          ($1, 'PAYMENT_CREATED', 'PAYMENT', 'PAYMENT', $2),
          ($1, 'PAYMENT_REVERSED', 'PAYMENT', 'PAYMENT', $3),
          ($1, 'BILL_GENERATED', 'BILLING', 'BILL', $4)`,
        [staffId, pay1Id, pay4Id, billId]
      );

      // Write physical files in source storage directory
      fs.mkdirSync(path.join(sourceStorageDir, 'documents'), { recursive: true });
      fs.mkdirSync(path.join(sourceStorageDir, 'bills', 'bill_1'), { recursive: true });

      fs.writeFileSync(path.join(sourceStorageDir, 'documents', 'pod_trip001.pdf'), 'PDF binary stream for Trip 1 POD');
      fs.writeFileSync(path.join(sourceStorageDir, 'documents', 'fitness_trailer.pdf'), 'PDF binary stream for Fitness Certificate');
      fs.writeFileSync(path.join(sourceStorageDir, 'bills', 'bill_1', 'v1.pdf'), 'PDF binary stream for Bill 1 V1');
      fs.writeFileSync(path.join(sourceStorageDir, 'bills', 'bill_1', 'v2.pdf'), 'PDF binary stream for Bill 1 V2');
    }, 60000);

    afterAll(async () => {
      await sourcePool?.end();
      await targetPool?.end();
    }, 30000);

    it('creates pg_dump binary custom-format backup of source database', () => {
      const start = Date.now();
      const dumpCmd = `pg_dump -Fc -v -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${DB_SOURCE} -f "${backupDumpPath}"`;
      const output = execSync(dumpCmd, { stdio: 'pipe', encoding: 'utf-8' });
      measuredDumpMs = Date.now() - start;

      expect(fs.existsSync(backupDumpPath)).toBe(true);
      expect(fs.statSync(backupDumpPath).size).toBeGreaterThan(1000);
      expect(measuredDumpMs).toBeLessThan(15000); // Measured local dump duration
    });

    it('restores backup into target database using pg_restore --exit-on-error', () => {
      const start = Date.now();
      const restoreCmd = `pg_restore --exit-on-error -v -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${DB_TARGET} "${backupDumpPath}"`;
      const output = execSync(restoreCmd, { stdio: 'pipe', encoding: 'utf-8' });
      measuredRestoreMs = Date.now() - start;

      expect(output).toBeDefined();
      expect(measuredRestoreMs).toBeLessThan(15000); // Measured local restore duration
    });

    it('surfaces restore failure and halts with non-zero exit code on corrupted backup', () => {
      const corruptPath = path.join(tempDir, 'corrupted_backup.dump');
      fs.writeFileSync(corruptPath, 'CORRUPTED HEADER DATA NOT A VALID PGDUMP');

      let failed = false;
      let exitCode = 0;
      try {
        execSync(`pg_restore --exit-on-error -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${DB_TARGET} "${corruptPath}"`, {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
      } catch (err: any) {
        failed = true;
        exitCode = err.status || 1;
      }

      expect(failed).toBe(true);
      expect(exitCode).not.toBe(0);
    });

    it('reconciles and verifies the complete schema inventory (40 tables, 27 functions, 63 triggers, 77 FKs, 151 indexes)', async () => {
      // 1. All 40 canonical base tables exist
      const tablesRes = await targetPool.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
        ORDER BY table_name;
      `);
      expect(tablesRes.rows.length).toBe(40);
      const foundTableSet = new Set(tablesRes.rows.map((r: any) => r.table_name));
      for (const t of CANONICAL_TABLES_001) {
        expect(foundTableSet.has(t)).toBe(true);
      }

      // 2. All 27 application domain functions exist
      const funcsRes = await targetPool.query(`
        SELECT routine_name FROM information_schema.routines 
        WHERE routine_schema = 'public' AND routine_name = ANY($1)
      `, [CANONICAL_FUNCTIONS_001]);
      expect(funcsRes.rows.length).toBe(27);

      // 3. Exactly 63 non-internal triggers (50 normal + 13 deferred constraint triggers)
      const trigRes = await targetPool.query(`
        SELECT t.tgname, t.tgdeferrable 
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND NOT t.tgisinternal
      `);
      expect(trigRes.rows.length).toBe(63);

      const normalTrigs = trigRes.rows.filter((r: any) => !r.tgdeferrable);
      const constrTrigs = trigRes.rows.filter((r: any) => r.tgdeferrable);
      expect(normalTrigs.length).toBe(50);
      expect(constrTrigs.length).toBe(13);

      // 4. Constraints breakdown
      const constrTypeRes = await targetPool.query(`
        SELECT constraint_type, count(*) as count 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
        GROUP BY constraint_type;
      `);
      const constrMap = Object.fromEntries(constrTypeRes.rows.map((r: any) => [r.constraint_type, parseInt(r.count, 10)]));
      expect(constrMap['PRIMARY KEY']).toBe(40);
      expect(constrMap['FOREIGN KEY']).toBe(77);
      expect(constrMap['UNIQUE']).toBe(37);
      expect(constrMap['CHECK']).toBeGreaterThanOrEqual(400);

      // 5. Total Columns: 383
      const colsRes = await targetPool.query(`
        SELECT count(*) as count 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
      `);
      expect(parseInt(colsRes.rows[0].count, 10)).toBe(383);

      // 6. Indexes: 151
      const idxRes = await targetPool.query(`
        SELECT count(*) as count 
        FROM pg_indexes 
        WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
      `);
      expect(parseInt(idxRes.rows[0].count, 10)).toBe(151);

      // 7. Extensions: pgcrypto
      const extRes = await targetPool.query("SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'");
      expect(extRes.rows.length).toBe(1);

      // 8. Migration tracking
      const migRes = await targetPool.query('SELECT id FROM schema_migrations ORDER BY id ASC');
      expect(migRes.rows.map((r: any) => r.id)).toEqual(['001_initial_schema.sql', '002_add_document_expiry.sql']);
    });

    it('compares row counts across all 40 tables between source and restored database', async () => {
      // 21 Populated Test Tables
      const populatedTables = [
        'users', 'financial_years', 'bill_numbering_series', 'parties',
        'vehicle_owners', 'market_vehicles', 'own_fleet_vehicles',
        'trips', 'trip_party_financials', 'trip_vehicle_owner_financials',
        'bills', 'bill_items', 'bill_versions', 'bill_version_items', 'payments', 'payment_allocations',
        'party_credits', 'documents', 'document_links', 'audit_events',
        'dynamic_field_definitions'
      ];

      for (const table of populatedTables) {
        const sRes = await sourcePool.query(`SELECT count(*) as count FROM ${table}`);
        const tRes = await targetPool.query(`SELECT count(*) as count FROM ${table}`);

        const sCount = parseInt(sRes.rows[0].count, 10);
        const tCount = parseInt(tRes.rows[0].count, 10);

        sourceCounts[table] = sCount;
        targetCounts[table] = tCount;

        expect(tCount).toBe(sCount);
        expect(tCount).toBeGreaterThan(0);
      }

      // The remaining 19 canonical tables are verified empty (0 rows) in both source and restored target
      const remainingTables = CANONICAL_TABLES_001.filter((t) => !populatedTables.includes(t));
      expect(remainingTables.length).toBe(19);

      for (const table of remainingTables) {
        const sRes = await sourcePool.query(`SELECT count(*) as count FROM ${table}`);
        const tRes = await targetPool.query(`SELECT count(*) as count FROM ${table}`);
        expect(parseInt(sRes.rows[0].count, 10)).toBe(0);
        expect(parseInt(tRes.rows[0].count, 10)).toBe(0);
      }
    });

    it('compares critical financial invariants before and after restoration', async () => {
      // Financial Invariant 1: Net P&L (Active Incoming - Active Outgoing)
      const pnlQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN payment_type = 'INCOMING' AND payment_status = 'ACTIVE' THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN payment_type = 'OUTGOING' AND payment_status = 'ACTIVE' THEN amount ELSE 0 END), 0) as net_pnl
        FROM payments
      `;
      const sPnlRes = await sourcePool.query(pnlQuery);
      const tPnlRes = await targetPool.query(pnlQuery);

      sourceNetPnl = parseFloat(sPnlRes.rows[0].net_pnl);
      targetNetPnl = parseFloat(tPnlRes.rows[0].net_pnl);

      expect(sourceNetPnl).toBe(75000); // 100k + 15k - 40k = 75k
      expect(targetNetPnl).toBe(sourceNetPnl);

      // Financial Invariant 2: Reversed payment completely excluded
      const revQuery = `SELECT count(*) as count, sum(amount) as total FROM payments WHERE payment_status = 'REVERSED'`;
      const sRev = await sourcePool.query(revQuery);
      const tRev = await targetPool.query(revQuery);
      expect(tRev.rows[0].count).toBe(sRev.rows[0].count);
      expect(parseFloat(tRev.rows[0].total)).toBe(10000);

      // Financial Invariant 3: Party Credits (Available balance: 20,000)
      const credQuery = `
        SELECT COALESCE(SUM(allocation_amount), 0) as balance 
        FROM payment_allocations 
        WHERE allocation_type = 'CREDIT_GENERATED' AND allocation_status = 'ACTIVE'
      `;
      const sCred = await sourcePool.query(credQuery);
      const tCred = await targetPool.query(credQuery);
      expect(parseFloat(tCred.rows[0].balance)).toBe(parseFloat(sCred.rows[0].balance));
      expect(parseFloat(tCred.rows[0].balance)).toBe(20000);

      // Operational Invariant 4: Bill status is PAID
      const billRes = await targetPool.query("SELECT bill_status, total_amount, balance_amount FROM bills WHERE bill_number = 'SRL/26-27/001'");
      expect(billRes.rows[0].bill_status).toBe('PAID');
      expect(parseFloat(billRes.rows[0].total_amount)).toBe(80000);
      expect(parseFloat(billRes.rows[0].balance_amount)).toBe(0);

      // Operational Invariant 5: Bill Version 2 is ACTIVE, Version 1 is SUPERSEDED
      const verRes = await targetPool.query("SELECT version_number, version_status FROM bill_versions WHERE bill_id = (SELECT id FROM bills WHERE bill_number = 'SRL/26-27/001') ORDER BY version_number ASC");
      expect(verRes.rows[0].version_status).toBe('SUPERSEDED');
      expect(verRes.rows[1].version_status).toBe('ACTIVE');

      // Compliance Invariant 6: Document Expiry Date preserved
      const docRes = await targetPool.query("SELECT original_name, expiry_date::text as expiry_date FROM documents WHERE document_type = 'FITNESS_CERTIFICATE'");
      expect(docRes.rows[0].expiry_date).toBe('2026-12-31');
    });
  });

  describe('3. Document Storage Backup, Restoration, Checksum & Integrity', () => {
    function computeChecksum(filePath: string): string {
      const data = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(data).digest('hex');
    }

    it('backs up and restores storage directory with byte-for-byte SHA-256 checksum identity', () => {
      const start = Date.now();
      // 1. Recursive copy from sourceStorageDir to targetStorageDir
      function copyDir(src: string, dest: string) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
      copyDir(sourceStorageDir, targetStorageDir);
      const copyMs = Date.now() - start;
      expect(copyMs).toBeLessThan(5000);

      // 2. Compare checksums of all files
      const sourceFiles = [
        path.join('documents', 'pod_trip001.pdf'),
        path.join('documents', 'fitness_trailer.pdf'),
        path.join('bills', 'bill_1', 'v1.pdf'),
        path.join('bills', 'bill_1', 'v2.pdf'),
      ];

      for (const relFile of sourceFiles) {
        const srcChecksum = computeChecksum(path.join(sourceStorageDir, relFile));
        const dstChecksum = computeChecksum(path.join(targetStorageDir, relFile));
        expect(dstChecksum).toBe(srcChecksum);
      }
    });

    it('streams restored documents through LocalStorageService', async () => {
      const storage = new LocalStorageService(targetStorageDir);
      const stream = storage.getStream('documents/pod_trip001.pdf');

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      const content = Buffer.concat(chunks).toString('utf-8');
      expect(content).toBe('PDF binary stream for Trip 1 POD');
    });

    it('performs dry-run storage audit and confirms safe retention policy protects historical bill versions', async () => {
      const targetPool = new Pool({
        connectionString: `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_TARGET}`,
      });

      try {
        const start = Date.now();
        // Run audit on clean restored storage
        const cleanReport = await reconcileStorage({
          storageDir: targetStorageDir,
          dbPool: targetPool,
          dryRun: true,
        });
        const auditMs = Date.now() - start;

        expect(cleanReport.totalDiskFiles).toBe(4);
        expect(cleanReport.missingFiles.length).toBe(0);
        expect(cleanReport.orphanFiles.length).toBe(0);
        expect(cleanReport.healthyCount).toBe(4);
        expect(cleanReport.retainedHistoricalCount).toBeGreaterThanOrEqual(1); // v1.pdf is superseded
        expect(cleanReport.dryRun).toBe(true);
        expect(auditMs).toBeLessThan(5000);

        // Introduce an unreferenced orphan file
        fs.writeFileSync(path.join(targetStorageDir, 'orphan_unreferenced_scan.pdf'), 'Orphan scan');

        // Introduce a missing file by deleting one document from storage
        fs.unlinkSync(path.join(targetStorageDir, 'documents', 'fitness_trailer.pdf'));

        const dirtyReport = await reconcileStorage({
          storageDir: targetStorageDir,
          dbPool: targetPool,
          dryRun: true,
        });

        expect(dirtyReport.missingFiles).toContain(path.normalize('documents/fitness_trailer.pdf'));
        expect(dirtyReport.orphanFiles).toContain('orphan_unreferenced_scan.pdf');

        // Verify that historical files were NOT touched or deleted
        expect(fs.existsSync(path.join(targetStorageDir, 'bills', 'bill_1', 'v1.pdf'))).toBe(true);
        expect(fs.existsSync(path.join(targetStorageDir, 'bills', 'bill_1', 'v2.pdf'))).toBe(true);
      } finally {
        await targetPool.end();
      }
    });
  });
});
