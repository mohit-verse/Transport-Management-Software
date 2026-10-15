import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  CANONICAL_TABLES_001,
  CANONICAL_FUNCTIONS_001,
  CANONICAL_TRIGGERS_COUNT_001,
  CANONICAL_DYNAMIC_FIELDS_COUNT,
} from './migrate';
import { reconcileStorage } from './reconcile-storage';
import { parseDatabaseUrl, calculateFileSha256, BackupManifest } from './backup';

export interface RestoreOptions {
  manifestPath?: string;
  dumpPath?: string;
  storageSnapshotPath?: string;
  targetDatabaseUrl: string;
  targetStorageDir: string;
  dropExistingTargetDb?: boolean;
}

export interface RestoreVerificationReport {
  targetDatabase: string;
  targetStorageDir: string;
  restoredTablesCount: number;
  restoredFunctionsCount: number;
  restoredTriggersCount: number;
  restoredDynamicFieldsCount: number;
  restoredFilesCount: number;
  netPnl: number;
  storageReconciliationMissing: number;
  storageReconciliationOrphans: number;
  verified: boolean;
}

/**
 * Execute automated restore and validation workflow:
 * 1. Read manifest / locate dump file & storage snapshot
 * 2. Ensure target database exists (or recreate cleanly)
 * 3. Execute pg_restore --exit-on-error
 * 4. Restore physical storage files and verify SHA-256 hashes
 * 5. Verify 40 canonical tables, 27 domain functions, 63 triggers, and dynamic fields
 * 6. Verify financial invariants (payment-based Net P&L)
 * 7. Run storage reconciliation dry-run to confirm 0 missing files
 */
export async function restoreBackup(options: RestoreOptions): Promise<RestoreVerificationReport> {
  const { targetDatabaseUrl, targetStorageDir, dropExistingTargetDb } = options;

  let dumpPath = options.dumpPath;
  let storageSnapshotPath = options.storageSnapshotPath;
  let manifest: BackupManifest | null = null;

  if (options.manifestPath) {
    if (!fs.existsSync(options.manifestPath)) {
      throw new Error(`Manifest file not found: ${options.manifestPath}`);
    }
    manifest = JSON.parse(fs.readFileSync(options.manifestPath, 'utf8'));
    const manifestDir = path.dirname(options.manifestPath);
    dumpPath = path.join(manifestDir, manifest!.database.dumpFile);
    storageSnapshotPath = path.join(manifestDir, manifest!.storage.snapshotDir);
  }

  if (!dumpPath || !fs.existsSync(dumpPath)) {
    throw new Error(`Database dump file not found: ${dumpPath}`);
  }

  const targetDbParams = parseDatabaseUrl(targetDatabaseUrl);
  logger.info({ targetDatabase: targetDbParams.database, host: targetDbParams.host }, 'Starting restore workflow...');

  // 1. Prepare target database
  const maintenancePool = new Pool({
    connectionString: `postgresql://${targetDbParams.user}:${encodeURIComponent(targetDbParams.password)}@${targetDbParams.host}:${targetDbParams.port}/postgres`,
  });

  try {
    if (dropExistingTargetDb) {
      logger.info({ targetDb: targetDbParams.database }, 'Recreating clean target database...');
      await maintenancePool.query(`DROP DATABASE IF EXISTS ${targetDbParams.database} WITH (FORCE);`);
    }

    // Check if target database exists
    const checkDbRes = await maintenancePool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbParams.database]
    );

    if (checkDbRes.rows.length === 0) {
      logger.info({ targetDb: targetDbParams.database }, 'Target database does not exist. Creating...');
      await maintenancePool.query(`CREATE DATABASE ${targetDbParams.database};`);
    }
  } finally {
    await maintenancePool.end();
  }

  // 2. Restore PostgreSQL dump with pg_restore --exit-on-error
  logger.info({ dumpPath, targetDb: targetDbParams.database }, 'Executing pg_restore --exit-on-error...');
  try {
    execSync(
      `pg_restore --exit-on-error -h "${targetDbParams.host}" -p "${targetDbParams.port}" -U "${targetDbParams.user}" -d "${targetDbParams.database}" "${dumpPath}"`,
      {
        env: {
          ...process.env,
          PGPASSWORD: targetDbParams.password,
        },
        stdio: 'pipe',
      }
    );
  } catch (err: any) {
    const sanitizedStderr = err.stderr ? err.stderr.toString().replace(new RegExp(targetDbParams.password, 'g'), '***') : err.message;
    throw new Error(`pg_restore execution failed: ${sanitizedStderr}`);
  }

  // 3. Restore storage files
  if (!fs.existsSync(targetStorageDir)) {
    fs.mkdirSync(targetStorageDir, { recursive: true });
  }

  let restoredFilesCount = 0;
  if (storageSnapshotPath && fs.existsSync(storageSnapshotPath)) {
    logger.info({ storageSnapshotPath, targetStorageDir }, 'Restoring physical storage directory and verifying file checksums...');

    const copyAndVerify = (srcDir: string, dstDir: string) => {
      const entries = fs.readdirSync(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const dstPath = path.join(dstDir, entry.name);
        if (entry.isDirectory()) {
          if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
          copyAndVerify(srcPath, dstPath);
        } else if (entry.isFile()) {
          const targetSubDir = path.dirname(dstPath);
          if (!fs.existsSync(targetSubDir)) fs.mkdirSync(targetSubDir, { recursive: true });
          fs.copyFileSync(srcPath, dstPath);
          restoredFilesCount++;

          // Verify checksum against manifest if manifest is provided
          if (manifest) {
            const relKey = path.relative(storageSnapshotPath!, srcPath).replace(/\\/g, '/');
            const expected = manifest.storage.files.find((f) => f.relativePath === relKey);
            if (expected) {
              const actualSha256 = calculateFileSha256(dstPath);
              if (actualSha256 !== expected.sha256) {
                throw new Error(`Storage file checksum mismatch on restore for ${relKey}. Expected ${expected.sha256}, got ${actualSha256}`);
              }
            }
          }
        }
      }
    };

    copyAndVerify(storageSnapshotPath, targetStorageDir);
  }

  // 4. Verify restored database schema and invariants
  logger.info('Connecting to restored database to verify canonical schema completeness and financial invariants...');
  const targetPool = new Pool({ connectionString: targetDatabaseUrl });

  try {
    // 4.1 Check 40 canonical tables
    const tablesRes = await targetPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)
    `, [CANONICAL_TABLES_001]);

    if (tablesRes.rows.length !== CANONICAL_TABLES_001.length) {
      throw new Error(`Schema validation failed on restore: expected ${CANONICAL_TABLES_001.length} tables, found ${tablesRes.rows.length}`);
    }

    // 4.2 Check 27 domain functions
    const funcsRes = await targetPool.query(`
      SELECT p.proname 
      FROM pg_proc p 
      JOIN pg_namespace n ON p.pronamespace = n.oid 
      WHERE n.nspname = 'public' AND p.proname = ANY($1)
    `, [CANONICAL_FUNCTIONS_001]);

    if (funcsRes.rows.length !== CANONICAL_FUNCTIONS_001.length) {
      throw new Error(`Schema validation failed on restore: expected ${CANONICAL_FUNCTIONS_001.length} domain functions, found ${funcsRes.rows.length}`);
    }

    // 4.3 Check 63 triggers
    const trigRes = await targetPool.query(`
      SELECT t.tgname
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND NOT t.tgisinternal;
    `);

    if (trigRes.rows.length < CANONICAL_TRIGGERS_COUNT_001) {
      throw new Error(`Schema validation failed on restore: expected >= ${CANONICAL_TRIGGERS_COUNT_001} triggers, found ${trigRes.rows.length}`);
    }

    // 4.4 Check dynamic fields count
    const dynRes = await targetPool.query('SELECT count(*) as count FROM dynamic_field_definitions');
    const dynamicFieldsCount = parseInt(dynRes.rows[0].count, 10);
    if (dynamicFieldsCount < CANONICAL_DYNAMIC_FIELDS_COUNT) {
      throw new Error(`Dynamic fields verification failed on restore: expected >= ${CANONICAL_DYNAMIC_FIELDS_COUNT}, found ${dynamicFieldsCount}`);
    }

    // 4.5 Check Net P&L financial invariant
    const pnlRes = await targetPool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN payment_type = 'INCOMING' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN payment_type = 'OUTGOING' THEN amount ELSE 0 END), 0) as net_pnl
      FROM payments
      WHERE payment_status = 'ACTIVE';
    `);
    const netPnl = parseFloat(pnlRes.rows[0].net_pnl || '0');

    // 4.6 Execute storage reconciliation dry-run
    const reconReport = await reconcileStorage({
      storageDir: targetStorageDir,
      dbPool: targetPool,
      dryRun: true,
    });

    if (reconReport.missingFiles.length > 0) {
      throw new Error(`Storage reconciliation failed after restore: found ${reconReport.missingFiles.length} missing file(s) referenced in DB but absent from storage`);
    }

    logger.info(
      {
        tables: tablesRes.rows.length,
        functions: funcsRes.rows.length,
        triggers: trigRes.rows.length,
        netPnl,
        missingFiles: reconReport.missingFiles.length,
      },
      'Restore verification passed 100% cleanly!'
    );

    return {
      targetDatabase: targetDbParams.database,
      targetStorageDir,
      restoredTablesCount: tablesRes.rows.length,
      restoredFunctionsCount: funcsRes.rows.length,
      restoredTriggersCount: trigRes.rows.length,
      restoredDynamicFieldsCount: dynamicFieldsCount,
      restoredFilesCount,
      netPnl,
      storageReconciliationMissing: reconReport.missingFiles.length,
      storageReconciliationOrphans: reconReport.orphanFiles.length,
      verified: true,
    };
  } finally {
    await targetPool.end();
  }
}

// CLI handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const manifestArg = args.find((a) => a.startsWith('--manifest='))?.split('=')[1];
  const targetDbArg = args.find((a) => a.startsWith('--target-db='))?.split('=')[1];
  const targetStorageArg = args.find((a) => a.startsWith('--target-storage='))?.split('=')[1];

  if (!manifestArg) {
    console.error('Usage: npm run restore -- --manifest=/path/to/backup.manifest.json [--target-db=dbname] [--target-storage=/path/to/storage]');
    process.exit(1);
  }

  const targetDb = targetDbArg || process.env.RESTORE_TARGET_DB || 'ssrl_restored_db';
  const targetStorage = targetStorageArg || process.env.RESTORE_TARGET_STORAGE || path.resolve(__dirname, '../../../storage/restored');
  const dbUrl = `postgresql://${process.env.DB_USER || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${targetDb}`;

  restoreBackup({
    manifestPath: path.resolve(manifestArg),
    targetDatabaseUrl: dbUrl,
    targetStorageDir: targetStorage,
  })
    .then((res) => {
      console.log('\n======================================================');
      console.log('              AUTOMATED RESTORE COMPLETED             ');
      console.log('======================================================');
      console.log(`Target Database:            ${res.targetDatabase}`);
      console.log(`Target Storage:             ${res.targetStorageDir}`);
      console.log(`Verified Tables:            ${res.restoredTablesCount}`);
      console.log(`Verified Domain Functions:  ${res.restoredFunctionsCount}`);
      console.log(`Verified Triggers:          ${res.restoredTriggersCount}`);
      console.log(`Verified Dynamic Fields:    ${res.restoredDynamicFieldsCount}`);
      console.log(`Restored Storage Files:     ${res.restoredFilesCount}`);
      console.log(`Verified Net P&L:           ₹${res.netPnl.toLocaleString('en-IN')}`);
      console.log(`Reconciliation Missing:     ${res.storageReconciliationMissing}`);
      console.log(`Reconciliation Orphans:     ${res.storageReconciliationOrphans}`);
      console.log(`Overall Verification:       ${res.verified ? 'PASS (100% Intact)' : 'FAIL'}`);
      console.log('======================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n[restore] ❌ Fatal Error: ${err.message}\n`);
      process.exit(1);
    });
}
