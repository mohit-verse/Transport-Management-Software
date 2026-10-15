import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { config } from '../config';

export interface StorageReconciliationReport {
  scannedDirectory: string;
  totalDiskFiles: number;
  totalDbReferences: number;
  healthyCount: number;
  missingFiles: string[];
  orphanFiles: string[];
  retainedHistoricalCount: number;
  dryRun: boolean;
}

export interface ReconcileOptions {
  storageDir?: string;
  dbPool?: Pool;
  dryRun?: boolean;
}

export async function reconcileStorage(options?: ReconcileOptions): Promise<StorageReconciliationReport> {
  const baseDir = path.resolve(options?.storageDir || config.storage.dir);
  const pool = options?.dbPool || new Pool({ connectionString: config.db.url });
  const isDryRun = options?.dryRun !== false; // Default to true for safety

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Storage directory does not exist: ${baseDir}`);
  }

  // 1. Gather all referenced storage keys from database (including soft-deleted and historical)
  const client = await pool.connect();
  let dbKeys = new Set<string>();
  let historicalKeys = new Set<string>();

  try {
    // Documents table (both active and soft-deleted records)
    const docRes = await client.query('SELECT storage_key, is_deleted FROM documents');
    docRes.rows.forEach((r: any) => {
      if (r.storage_key) {
        const normalized = path.normalize(r.storage_key).replace(/^(\.\.[\/\\])+/, '');
        dbKeys.add(normalized);
        if (r.is_deleted) {
          historicalKeys.add(normalized);
        }
      }
    });

    // Check if bill_versions table exists and has document_reference
    const checkBvRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'bill_versions' AND column_name = 'document_reference'
      );
    `);
    if (checkBvRes.rows[0].exists) {
      const bvRes = await client.query('SELECT document_reference, version_status FROM bill_versions');
      bvRes.rows.forEach((r: any) => {
        if (r.document_reference) {
          const normalized = path.normalize(r.document_reference).replace(/^(\.\.[\/\\])+/, '');
          dbKeys.add(normalized);
          if (r.version_status === 'SUPERSEDED') {
            historicalKeys.add(normalized);
          }
        }
      });
    }
  } finally {
    client.release();
    if (!options?.dbPool) {
      await pool.end();
    }
  }

  // 2. Recursively find all files on disk within baseDir
  const diskFiles: string[] = [];
  function scanDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const relativeKey = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        diskFiles.push(relativeKey);
      }
    }
  }
  scanDir(baseDir);

  const diskFileSet = new Set(diskFiles.map((f) => path.normalize(f)));

  // 3. Identify missing files (in DB, not on disk)
  const missingFiles: string[] = [];
  let healthyCount = 0;
  for (const dbKey of dbKeys) {
    if (diskFileSet.has(dbKey)) {
      healthyCount++;
    } else {
      missingFiles.push(dbKey);
    }
  }

  // 4. Identify orphan files (on disk, not in DB)
  const orphanFiles: string[] = [];
  for (const diskFile of diskFiles) {
    const normalized = path.normalize(diskFile);
    if (!dbKeys.has(normalized)) {
      orphanFiles.push(diskFile);
    }
  }

  return {
    scannedDirectory: baseDir,
    totalDiskFiles: diskFiles.length,
    totalDbReferences: dbKeys.size,
    healthyCount,
    missingFiles,
    orphanFiles,
    retainedHistoricalCount: historicalKeys.size,
    dryRun: isDryRun,
  };
}

// CLI execution handler
if (require.main === module) {
  const isDryRun = !process.argv.includes('--execute-cleanup');
  console.log(`[reconcile-storage] Starting storage audit (DryRun: ${isDryRun})...`);

  reconcileStorage({ dryRun: isDryRun })
    .then((report) => {
      console.log('\n======================================================');
      console.log('           STORAGE RECONCILIATION REPORT              ');
      console.log('======================================================');
      console.log(`Scanned Directory:          ${report.scannedDirectory}`);
      console.log(`Total Physical Disk Files:  ${report.totalDiskFiles}`);
      console.log(`Total Database References:  ${report.totalDbReferences}`);
      console.log(`Healthy Matched Files:      ${report.healthyCount}`);
      console.log(`Retained Historical Files:  ${report.retainedHistoricalCount}`);
      console.log(`Missing Physical Files:     ${report.missingFiles.length}`);
      console.log(`Unreferenced Orphan Files:  ${report.orphanFiles.length}`);
      console.log('======================================================');

      if (report.missingFiles.length > 0) {
        console.warn('⚠️ MISSING FILES (Referenced in DB but missing from disk):');
        report.missingFiles.slice(0, 10).forEach((f) => console.warn(`  - ${f}`));
        if (report.missingFiles.length > 10) console.warn(`  ... and ${report.missingFiles.length - 10} more`);
      }

      if (report.orphanFiles.length > 0) {
        console.log('ℹ️ ORPHAN FILES (Present on disk but unreferenced):');
        report.orphanFiles.slice(0, 10).forEach((f) => console.log(`  - ${f}`));
        if (report.orphanFiles.length > 10) console.log(`  ... and ${report.orphanFiles.length - 10} more`);
      }

      console.log(`\nMode: ${report.dryRun ? 'DRY-RUN ONLY (No files were deleted)' : 'LIVE EXECUTION'}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[reconcile-storage] ❌ Error: ${err.message}`);
      process.exit(1);
    });
}
