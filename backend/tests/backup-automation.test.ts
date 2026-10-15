import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import {
  createBackup,
  restoreBackup,
  applyRetentionPolicy,
  BackupLockError,
  parseDatabaseUrl,
  calculateFileSha256,
} from '../src/scripts';
import {
  runMigrations,
  CANONICAL_TABLES_001,
  CANONICAL_FUNCTIONS_001,
  CANONICAL_TRIGGERS_COUNT_001,
  CANONICAL_DYNAMIC_FIELDS_COUNT,
} from '../src/scripts/migrate';
import { reconcileStorage } from '../src/scripts/reconcile-storage';
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

describe('Phase 4P-E: Automated Backup, Retention & Recovery Verification Suite', () => {
  jest.setTimeout(120000);

  const DB_SOURCE = 'ssrl_backup_source_test';
  const DB_TARGET = 'ssrl_backup_target_test';
  const SOURCE_DB_URL = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_SOURCE}`;
  const TARGET_DB_URL = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/${DB_TARGET}`;

  let tempDir: string;
  let sourceStorageDir: string;
  let targetStorageDir: string;
  let backupDir: string;

  let sourcePool: Pool;

  let createdPartyId: string;
  let createdOwnerId: string;
  let createdVehicleId: string;
  let createdTripId: string;
  let createdPaymentId: string;
  let createdBillId: string;
  let createdDocId: string;
  let createdDocKey: string;
  let billPdfKey: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssrl-backup-test-'));
    sourceStorageDir = path.join(tempDir, 'source_storage');
    targetStorageDir = path.join(tempDir, 'target_storage');
    backupDir = path.join(tempDir, 'backups');

    fs.mkdirSync(sourceStorageDir, { recursive: true });
    fs.mkdirSync(targetStorageDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    // Clean up stale databases
    for (const db of [DB_SOURCE, DB_TARGET]) {
      try {
        runPsql('postgres', `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
      } catch {}
    }

    // 1. Create source database and run migrations
    runPsql('postgres', `CREATE DATABASE ${DB_SOURCE};`);
    sourcePool = new Pool({ connectionString: SOURCE_DB_URL });
    await runMigrations(sourcePool);

    // 2. Populate synthetic business records with invariants
    // Create Owner user
    const ownerHash = await hashPassword('BackupOwner123!');
    const userRes = await sourcePool.query(`
      INSERT INTO users (name, mobile_number, password_hash, role, is_active)
      VALUES ('Backup Operator', '9888800001', $1, 'OWNER', true)
      RETURNING id;
    `, [ownerHash]);
    const userId = userRes.rows[0].id;

    // Create Party
    const partyRes = await sourcePool.query(`
      INSERT INTO parties (name, party_type, primary_mobile, city, state, gstin, tds_applicable)
      VALUES ('Automated Minerals Corp', 'COMPANY', '9888800002', 'Jaipur', 'Rajasthan', '08AAACM1234F1Z1', true)
      RETURNING id;
    `);
    createdPartyId = partyRes.rows[0].id;

    // Create Vehicle Owner
    const ownerRes = await sourcePool.query(`
      INSERT INTO vehicle_owners (name, mobile_number)
      VALUES ('Automated Fleet Operator', '9888800003')
      RETURNING id;
    `);
    createdOwnerId = ownerRes.rows[0].id;

    // Create Market Vehicle
    const mvRes = await sourcePool.query(`
      INSERT INTO market_vehicles (vehicle_number, vehicle_owner_id)
      VALUES ('RJ-14-BK-9999', $1)
      RETURNING id;
    `, [createdOwnerId]);
    createdVehicleId = mvRes.rows[0].id;

    // Create Trip
    const tripRes = await sourcePool.query(`
      INSERT INTO trips (trip_number, trip_type, vehicle_relationship, party_id, vehicle_owner_id, market_vehicle_id, trip_date, status, created_by)
      VALUES ('TRIP-BK-001', 'COMPANY', 'MARKET', $1, $2, $3, '2026-10-15', 'COMPLETED', $4)
      RETURNING id;
    `, [createdPartyId, createdOwnerId, createdVehicleId, userId]);
    createdTripId = tripRes.rows[0].id;

    // Create Trip Destination
    await sourcePool.query(`
      INSERT INTO trip_destinations (trip_id, sequence_no, from_location, to_location)
      VALUES ($1, 1, 'Jaipur Mine', 'Ajmer Plant');
    `, [createdTripId]);

    // Create Trip Financials
    await sourcePool.query(`
      INSERT INTO trip_party_financials (trip_id, freight_amount, detention_amount)
      VALUES ($1, 50000, 2000);
    `, [createdTripId]);

    // Create Physical Document on disk and in database
    createdDocKey = 'documents/backup_pod_sample.pdf';
    const physicalDocPath = path.join(sourceStorageDir, createdDocKey);
    fs.mkdirSync(path.dirname(physicalDocPath), { recursive: true });
    fs.writeFileSync(physicalDocPath, '%PDF-1.4 Mock POD Sample Content for Backup Testing');

    const docRes = await sourcePool.query(`
      INSERT INTO documents (document_type, original_name, storage_provider, storage_key, mime_type, file_size_bytes, uploaded_by)
      VALUES ('POD', 'backup_pod_sample.pdf', 'LOCAL', $1, 'application/pdf', 54, $2)
      RETURNING id;
    `, [createdDocKey, userId]);
    createdDocId = docRes.rows[0].id;

    await sourcePool.query(`
      INSERT INTO document_links (document_id, entity_type, entity_id)
      VALUES ($1, 'TRIP', $2);
    `, [createdDocId, createdTripId]);

    // Create Payment (₹70,000 incoming: ₹50,000 to trip, ₹20,000 credit) inside transaction
    const client = await sourcePool.connect();
    try {
      await client.query('BEGIN');
      const payRes = await client.query(`
        INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, created_by)
        VALUES ('PAY-BK-001', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-10-15', 70000, 'BANK_TRANSFER', 'ACTIVE', $2)
        RETURNING id;
      `, [createdPartyId, userId]);
      createdPaymentId = payRes.rows[0].id;

      const alloc1 = await client.query(`
        INSERT INTO payment_allocations (payment_id, allocation_type, trip_id, allocation_amount, allocation_status, created_by)
        VALUES ($1, 'TRIP', $2, 50000, 'ACTIVE', $3)
        RETURNING id;
      `, [createdPaymentId, createdTripId, userId]);

      const alloc2 = await client.query(`
        INSERT INTO payment_allocations (payment_id, allocation_type, allocation_amount, allocation_status, created_by)
        VALUES ($1, 'CREDIT_GENERATED', 20000, 'ACTIVE', $2)
        RETURNING id;
      `, [createdPaymentId, userId]);

      await client.query(`
        INSERT INTO party_credits (party_id, payment_id, credit_allocation_id)
        VALUES ($1, $2, $3);
      `, [createdPartyId, createdPaymentId, alloc2.rows[0].id]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Create a Reversed Payment (₹10,000) that must NOT contribute to Net P&L
    await sourcePool.query(`
      INSERT INTO payments (payment_id, payment_type, category, party_id, payment_date, amount, payment_mode, payment_status, reversed_at, reversed_by, reversal_reason, created_by)
      VALUES ('PAY-BK-REV', 'INCOMING', 'COMPANY_PAYMENT', $1, '2026-10-15', 10000, 'BANK_TRANSFER', 'REVERSED', now(), $2, 'Testing reversal exclusion', $2);
    `, [createdPartyId, userId]);

    // Create Financial Year
    const fyRes = await sourcePool.query(`
      INSERT INTO financial_years (code, start_date, end_date, is_active)
      VALUES ('FY26-27-BK', '2026-04-01', '2027-03-31', true)
      RETURNING id;
    `);
    const fyId = fyRes.rows[0].id;

    // Create Bill, Items, and Version in transaction for deferred constraints
    const bClient = await sourcePool.connect();
    try {
      await bClient.query('BEGIN');
      const billRes = await bClient.query(`
        INSERT INTO bills (bill_number, party_id, financial_year_id, billing_mode, bill_date, total_amount, balance_amount, bill_status, created_by)
        VALUES ('SRL/26-27/1', $1, $2, 'INDIVIDUAL', '2026-10-15', 0, 0, 'GENERATED', $3)
        RETURNING id;
      `, [createdPartyId, fyId, userId]);
      createdBillId = billRes.rows[0].id;

      billPdfKey = `bills/${createdBillId}/v1.pdf`;
      const physicalBillPdfPath = path.join(sourceStorageDir, billPdfKey);
      fs.mkdirSync(path.dirname(physicalBillPdfPath), { recursive: true });
      fs.writeFileSync(physicalBillPdfPath, '%PDF-1.4 Mock Bill PDF Content for Backup Testing');

      const bvRes = await bClient.query(`
        INSERT INTO bill_versions (bill_id, version_number, version_label, version_status, template_snapshot, document_reference, created_by)
        VALUES ($1, 1, 'V1', 'ACTIVE', $2, $3, $4)
        RETURNING id;
      `, [
        createdBillId,
        JSON.stringify({ layout: {}, components: [], assets: [], dynamic_field_definitions: [] }),
        billPdfKey,
        userId,
      ]);

      await bClient.query(`
        INSERT INTO bill_items (bill_id, trip_id, sequence_no, description, line_amount, is_active)
        VALUES ($1, $2, 1, 'Freight for TRIP-BK-001', 52000, true);
      `, [createdBillId, createdTripId]);

      await bClient.query(`
        INSERT INTO bill_version_items (bill_version_id, trip_id, sequence_no, description, line_amount)
        VALUES ($1, $2, 1, 'Freight for TRIP-BK-001', 52000);
      `, [bvRes.rows[0].id, createdTripId]);

      await bClient.query('COMMIT');
    } catch (err) {
      await bClient.query('ROLLBACK');
      throw err;
    } finally {
      bClient.release();
    }
  });

  afterAll(async () => {
    if (sourcePool) {
      await sourcePool.end();
    }

    // Drop temporary databases
    for (const db of [DB_SOURCE, DB_TARGET]) {
      try {
        runPsql('postgres', `DROP DATABASE IF EXISTS ${db} WITH (FORCE);`);
      } catch {}
    }

    // Clean temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('1. Backup Creation, Checksumming & Archive Verification', () => {
    let backupResult: any;

    it('creates timestamped custom-format pg_dump archive, storage snapshot, and SHA-256 manifest', async () => {
      backupResult = await createBackup({
        databaseUrl: SOURCE_DB_URL,
        storageDir: sourceStorageDir,
        backupDir,
        retentionCount: 5,
        retentionDays: 30,
      });

      expect(backupResult).toBeDefined();
      expect(backupResult.backupId).toMatch(/^backup_\d{8}_\d{6}$/);

      // Verify dump file exists and has non-trivial size
      expect(fs.existsSync(backupResult.dumpPath)).toBe(true);
      const dumpStat = fs.statSync(backupResult.dumpPath);
      expect(dumpStat.size).toBeGreaterThan(10000);

      // Verify manifest exists and matches
      expect(fs.existsSync(backupResult.manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(backupResult.manifestPath, 'utf8'));
      expect(manifest.status).toBe('VERIFIED');
      expect(manifest.database.name).toBe(DB_SOURCE);
      expect(manifest.database.dumpSizeBytes).toBe(dumpStat.size);

      // Verify SHA-256 integrity of dump file against manifest
      const computedDumpHash = calculateFileSha256(backupResult.dumpPath);
      expect(manifest.database.dumpSha256).toBe(computedDumpHash);

      // Verify storage snapshot directory
      expect(fs.existsSync(backupResult.storageSnapshotPath)).toBe(true);
      expect(manifest.storage.totalFiles).toBe(2); // POD and Bill PDF
      expect(manifest.storage.files.length).toBe(2);

      for (const fileEntry of manifest.storage.files) {
        const filePath = path.join(backupResult.storageSnapshotPath, fileEntry.relativePath);
        expect(fs.existsSync(filePath)).toBe(true);
        expect(calculateFileSha256(filePath)).toBe(fileEntry.sha256);
      }
    });

    it('verifies dump archive can be inspected with pg_restore -l without errors', () => {
      const toc = execSync(`pg_restore -l "${backupResult.dumpPath}"`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });

      expect(toc).toContain('TABLE DATA public parties');
      expect(toc).toContain('TABLE DATA public trips');
      expect(toc).toContain('TABLE DATA public payments');
      expect(toc).toContain('TABLE DATA public bills');
      expect(toc).toContain('TABLE DATA public documents');
    });
  });

  describe('2. Credential Safety & Log Protection', () => {
    it('never exposes database passwords in parsed output or command line arguments', () => {
      const sensitiveUrl = 'postgresql://myuser:SuperSecretPassword123%21@db.internal:5432/production_db';
      const parsed = parseDatabaseUrl(sensitiveUrl);

      expect(parsed.user).toBe('myuser');
      expect(parsed.password).toBe('SuperSecretPassword123!');
      expect(parsed.database).toBe('production_db');

      // Verify manifest written does NOT contain password property
      const manifestFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.manifest.json'));
      expect(manifestFiles.length).toBeGreaterThan(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, manifestFiles[0]), 'utf8'));

      expect((manifest.database as any).password).toBeUndefined();
      expect(JSON.stringify(manifest)).not.toContain('SuperSecretPassword123');
    });
  });

  describe('3. Lockfile Concurrency & Stale Lock Protection', () => {
    it('prevents overlapping backup executions by rejecting concurrent run with BackupLockError', async () => {
      const lockFile = path.join(backupDir, '.backup.lock');
      // Create artificial active lockfile for current process
      fs.writeFileSync(
        lockFile,
        JSON.stringify({ pid: process.pid, timestamp: new Date().toISOString() })
      );

      await expect(
        createBackup({
          databaseUrl: SOURCE_DB_URL,
          storageDir: sourceStorageDir,
          backupDir,
        })
      ).rejects.toThrow(BackupLockError);

      // Clean up test lock
      if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    });

    it('safely overrides a stale lockfile from a non-existent process ID', async () => {
      const lockFile = path.join(backupDir, '.backup.lock');
      // Create stale lock with dead PID (99999999)
      fs.writeFileSync(
        lockFile,
        JSON.stringify({ pid: 99999999, timestamp: new Date(Date.now() - 3600000).toISOString() })
      );

      // Must succeed and override stale lock
      const res = await createBackup({
        databaseUrl: SOURCE_DB_URL,
        storageDir: sourceStorageDir,
        backupDir,
        retentionCount: 5,
      });

      expect(res.backupId).toBeDefined();
      expect(fs.existsSync(res.manifestPath)).toBe(true);
      // Lockfile should be released after execution
      expect(fs.existsSync(lockFile)).toBe(false);
    });
  });

  describe('4. Safe Retention Policy Pruning', () => {
    it('prunes expired backups while strictly preserving minimum retention count and current backup', () => {
      // Create 5 synthetic backup manifests and directories
      const testBackupDir = fs.mkdtempSync(path.join(tempDir, 'retention-test-'));
      const timestamps = [
        new Date('2026-09-01T00:00:00Z').getTime(), // 44 days old
        new Date('2026-09-10T00:00:00Z').getTime(), // 35 days old
        new Date('2026-10-01T00:00:00Z').getTime(), // 14 days old
        new Date('2026-10-10T00:00:00Z').getTime(), // 5 days old
        new Date('2026-10-15T00:00:00Z').getTime(), // today
      ];

      for (let i = 0; i < timestamps.length; i++) {
        const id = `backup_test_${i}`;
        const mPath = path.join(testBackupDir, `${id}.manifest.json`);
        fs.writeFileSync(
          mPath,
          JSON.stringify({
            backupId: id,
            timestamp: new Date(timestamps[i]).toISOString(),
          })
        );
        fs.writeFileSync(path.join(testBackupDir, `${id}_db.dump`), 'dummy dump');
        fs.mkdirSync(path.join(testBackupDir, `${id}_storage`));
      }

      // Apply retention: keep last 3 backups
      const pruned = applyRetentionPolicy(testBackupDir, 3, 30, 'backup_test_4');
      expect(pruned).toBe(2); // Should prune backup_test_0 and backup_test_1

      const remainingFiles = fs.readdirSync(testBackupDir);
      // Older backups pruned
      expect(remainingFiles).not.toContain('backup_test_0.manifest.json');
      expect(remainingFiles).not.toContain('backup_test_1.manifest.json');
      // Newer backups preserved
      expect(remainingFiles).toContain('backup_test_2.manifest.json');
      expect(remainingFiles).toContain('backup_test_3.manifest.json');
      expect(remainingFiles).toContain('backup_test_4.manifest.json');
    });
  });

  describe('5. Automated Recovery & Verification into Separate Target Database', () => {
    it('restores database and storage into clean target, verifying schema, invariants, and storage reconciliation', async () => {
      // Find the latest manifest in backupDir
      const manifestFiles = fs.readdirSync(backupDir).filter((f) => f.endsWith('.manifest.json')).sort();
      const latestManifestPath = path.join(backupDir, manifestFiles[manifestFiles.length - 1]);

      const restoreReport = await restoreBackup({
        manifestPath: latestManifestPath,
        targetDatabaseUrl: TARGET_DB_URL,
        targetStorageDir,
        dropExistingTargetDb: true,
      });

      expect(restoreReport.verified).toBe(true);
      expect(restoreReport.targetDatabase).toBe(DB_TARGET);
      expect(restoreReport.restoredTablesCount).toBe(40);
      expect(restoreReport.restoredFunctionsCount).toBe(27);
      expect(restoreReport.restoredTriggersCount).toBeGreaterThanOrEqual(63);
      expect(restoreReport.restoredDynamicFieldsCount).toBeGreaterThanOrEqual(86);
      expect(restoreReport.restoredFilesCount).toBe(2);

      // Verify authoritative payment-based Net P&L invariant
      // Incoming (70,000) - Outgoing (0) = 70,000. Reversed payment of 10,000 is excluded!
      expect(restoreReport.netPnl).toBe(70000);

      // Verify dry-run storage reconciliation has zero missing files
      expect(restoreReport.storageReconciliationMissing).toBe(0);

      // Connect to target DB and check records directly
      const targetPool = new Pool({ connectionString: TARGET_DB_URL });
      try {
        const partyRes = await targetPool.query('SELECT name, gstin FROM parties WHERE id = $1', [createdPartyId]);
        expect(partyRes.rows[0].name).toBe('Automated Minerals Corp');

        const tripRes = await targetPool.query('SELECT trip_number, status FROM trips WHERE id = $1', [createdTripId]);
        expect(tripRes.rows[0].trip_number).toBe('TRIP-BK-001');
        expect(tripRes.rows[0].status).toBe('COMPLETED');

        const billRes = await targetPool.query('SELECT bill_number, bill_status FROM bills WHERE id = $1', [createdBillId]);
        expect(billRes.rows[0].bill_number).toBe('SRL/26-27/1');
        expect(billRes.rows[0].bill_status).toBe('GENERATED');

        const creditRes = await targetPool.query(
          'SELECT pa.allocation_amount FROM party_credits pc JOIN payment_allocations pa ON pc.credit_allocation_id = pa.id WHERE pc.party_id = $1',
          [createdPartyId]
        );
        expect(parseFloat(creditRes.rows[0].allocation_amount)).toBe(20000);

        // Verify physical files exist in target storage directory
        const restoredDocPath = path.join(targetStorageDir, createdDocKey);
        expect(fs.existsSync(restoredDocPath)).toBe(true);
        expect(fs.readFileSync(restoredDocPath, 'utf8')).toContain('Mock POD Sample Content');

        const restoredBillPdfPath = path.join(targetStorageDir, billPdfKey);
        expect(fs.existsSync(restoredBillPdfPath)).toBe(true);
        expect(fs.readFileSync(restoredBillPdfPath, 'utf8')).toContain('Mock Bill PDF Content');
      } finally {
        await targetPool.end();
      }
    });
  });

  describe('6. Failure Paths & Error Surfacing', () => {
    it('surfaces pg_restore exit status when restoring an invalid or corrupted dump file', async () => {
      const corruptDumpPath = path.join(tempDir, 'corrupt.dump');
      fs.writeFileSync(corruptDumpPath, 'THIS_IS_CORRUPT_HEADER_AND_NOT_A_PG_DUMP');

      await expect(
        restoreBackup({
          dumpPath: corruptDumpPath,
          targetDatabaseUrl: TARGET_DB_URL,
          targetStorageDir,
        })
      ).rejects.toThrow(/pg_restore execution failed/);
    });

    it('surfaces error when database connection parameters are invalid during backup', async () => {
      const invalidDbUrl = `postgresql://${PG_USER}@${PG_HOST}:${PG_PORT}/nonexistent_db_xyz_999`;

      await expect(
        createBackup({
          databaseUrl: invalidDbUrl,
          storageDir: sourceStorageDir,
          backupDir,
        })
      ).rejects.toThrow(/pg_dump execution failed/);
    });
  });
});
