import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface BackupOptions {
  databaseUrl?: string;
  storageDir?: string;
  backupDir?: string;
  retentionCount?: number;
  retentionDays?: number;
}

export interface BackupManifest {
  timestamp: string;
  backupId: string;
  database: {
    host: string;
    port: string;
    name: string;
    user: string;
    dumpFile: string;
    dumpSizeBytes: number;
    dumpSha256: string;
  };
  storage: {
    snapshotDir: string;
    totalFiles: number;
    totalSizeBytes: number;
    files: Array<{
      relativePath: string;
      sizeBytes: number;
      sha256: string;
    }>;
  };
  status: 'VERIFIED' | 'FAILED';
}

export interface BackupResult {
  backupId: string;
  manifestPath: string;
  dumpPath: string;
  storageSnapshotPath: string;
  manifest: BackupManifest;
  prunedCount: number;
}

export class BackupLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupLockError';
  }
}

export function parseDatabaseUrl(urlStr: string) {
  const parsed = new URL(urlStr);
  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: decodeURIComponent(parsed.password || ''),
    database: parsed.pathname.replace(/^\//, ''),
  };
}

export function calculateFileSha256(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Acquire process lockfile to prevent overlapping backup runs.
 * If a stale lock (> 2 hours old or dead PID) exists, it is cleaned up.
 */
function acquireLock(lockFilePath: string): void {
  if (fs.existsSync(lockFilePath)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      const pid = lockData.pid;
      const createdAt = new Date(lockData.timestamp).getTime();
      const ageMs = Date.now() - createdAt;

      // Check if process is still alive
      let isAlive = false;
      try {
        if (pid && typeof pid === 'number') {
          process.kill(pid, 0); // Throws if process does not exist
          isAlive = true;
        }
      } catch {
        isAlive = false;
      }

      // If process is dead or lock is older than 2 hours (7200000ms), override stale lock
      if (!isAlive || ageMs > 7200000) {
        logger.warn({ pid, ageMs }, 'Found stale backup lockfile. Overriding stale lock.');
        fs.unlinkSync(lockFilePath);
      } else {
        throw new BackupLockError(
          `Another backup process (PID ${pid}, started ${lockData.timestamp}) is currently active. Overlapping backup runs are prohibited.`
        );
      }
    } catch (err: any) {
      if (err instanceof BackupLockError) throw err;
      // Corrupt lockfile, remove it
      try {
        fs.unlinkSync(lockFilePath);
      } catch {}
    }
  }

  // Create lockfile atomically
  const lockPayload = {
    pid: process.pid,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(lockFilePath, JSON.stringify(lockPayload, null, 2), { flag: 'wx' });
}

function releaseLock(lockFilePath: string): void {
  try {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to cleanly remove backup lockfile');
  }
}

/**
 * Execute automated backup workflow:
 * 1. Acquire lockfile
 * 2. Dump PostgreSQL database via pg_dump -Fc (passwords in env, masked in logs)
 * 3. Verify dump with pg_restore -l
 * 4. Snapshot physical storage files (documents, bills, templates) and compute SHA-256
 * 5. Write verified manifest
 * 6. Apply retention policy pruning
 * 7. Release lockfile
 */
export async function createBackup(options?: BackupOptions): Promise<BackupResult> {
  const dbUrl = options?.databaseUrl || config.db.url;
  const storageDir = path.resolve(options?.storageDir || config.storage.dir);
  const backupDir = path.resolve(options?.backupDir || config.backup.dir);
  const retentionCount = options?.retentionCount ?? config.backup.retentionCount;
  const retentionDays = options?.retentionDays ?? config.backup.retentionDays;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const lockFilePath = path.join(backupDir, '.backup.lock');
  acquireLock(lockFilePath);

  const now = new Date();
  const timestampStr = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  const backupId = `backup_${timestampStr}`;

  const dumpFileName = `${backupId}_db.dump`;
  const dumpFilePath = path.join(backupDir, dumpFileName);
  const storageSnapshotName = `${backupId}_storage`;
  const storageSnapshotDir = path.join(backupDir, storageSnapshotName);
  const manifestFileName = `${backupId}.manifest.json`;
  const manifestFilePath = path.join(backupDir, manifestFileName);

  const dbParams = parseDatabaseUrl(dbUrl);

  try {
    logger.info({ backupId, database: dbParams.database, host: dbParams.host }, 'Starting automated backup execution...');

    // 1. Snapshot storage files first
    fs.mkdirSync(storageSnapshotDir, { recursive: true });
    const storageFilesManifest: Array<{ relativePath: string; sizeBytes: number; sha256: string }> = [];
    let totalStorageBytes = 0;

    if (fs.existsSync(storageDir)) {
      const scanAndCopy = (sourceSubdir: string, destSubdir: string) => {
        if (!fs.existsSync(sourceSubdir)) return;
        const entries = fs.readdirSync(sourceSubdir, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(sourceSubdir, entry.name);
          const dstPath = path.join(destSubdir, entry.name);
          if (entry.isDirectory()) {
            if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
            scanAndCopy(srcPath, dstPath);
          } else if (entry.isFile()) {
            const dstDir = path.dirname(dstPath);
            if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
            fs.copyFileSync(srcPath, dstPath);
            const size = fs.statSync(dstPath).size;
            totalStorageBytes += size;
            const relKey = path.relative(storageSnapshotDir, dstPath).replace(/\\/g, '/');
            const sha256 = calculateFileSha256(dstPath);
            storageFilesManifest.push({
              relativePath: relKey,
              sizeBytes: size,
              sha256,
            });
          }
        }
      };

      scanAndCopy(path.join(storageDir, 'documents'), path.join(storageSnapshotDir, 'documents'));
      scanAndCopy(path.join(storageDir, 'bills'), path.join(storageSnapshotDir, 'bills'));
      scanAndCopy(path.join(storageDir, 'templates'), path.join(storageSnapshotDir, 'templates'));
    }

    // 2. Execute pg_dump -Fc
    logger.info({ dumpFile: dumpFileName }, 'Creating PostgreSQL custom-format dump...');
    try {
      execSync(
        `pg_dump -Fc -h "${dbParams.host}" -p "${dbParams.port}" -U "${dbParams.user}" -d "${dbParams.database}" -f "${dumpFilePath}"`,
        {
          env: {
            ...process.env,
            PGPASSWORD: dbParams.password,
          },
          stdio: 'pipe',
        }
      );
    } catch (err: any) {
      const sanitizedStderr = err.stderr ? err.stderr.toString().replace(new RegExp(dbParams.password, 'g'), '***') : err.message;
      throw new Error(`pg_dump execution failed: ${sanitizedStderr}`);
    }

    if (!fs.existsSync(dumpFilePath)) {
      throw new Error(`pg_dump succeeded but output file was not created: ${dumpFilePath}`);
    }

    const dumpStats = fs.statSync(dumpFilePath);
    if (dumpStats.size === 0) {
      throw new Error(`pg_dump generated an empty archive (0 bytes): ${dumpFilePath}`);
    }

    // 3. Inspect archive integrity with pg_restore -l
    logger.info('Inspecting backup archive table of contents with pg_restore -l...');
    try {
      const toc = execSync(`pg_restore -l "${dumpFilePath}"`, {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      if (!toc || toc.trim().length === 0) {
        throw new Error('pg_restore -l produced an empty table of contents');
      }
    } catch (err: any) {
      throw new Error(`Backup archive inspection failed with pg_restore: ${err.message}`);
    }

    const dumpSha256 = calculateFileSha256(dumpFilePath);

    // 4. Generate & write manifest
    const manifest: BackupManifest = {
      timestamp: now.toISOString(),
      backupId,
      database: {
        host: dbParams.host,
        port: dbParams.port,
        name: dbParams.database,
        user: dbParams.user,
        dumpFile: dumpFileName,
        dumpSizeBytes: dumpStats.size,
        dumpSha256,
      },
      storage: {
        snapshotDir: storageSnapshotName,
        totalFiles: storageFilesManifest.length,
        totalSizeBytes: totalStorageBytes,
        files: storageFilesManifest,
      },
      status: 'VERIFIED',
    };

    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2), 'utf8');
    logger.info({ backupId, manifestPath: manifestFilePath }, 'Backup manifest written and verified successfully.');

    // 5. Apply retention policy
    const prunedCount = applyRetentionPolicy(backupDir, retentionCount, retentionDays, backupId);

    return {
      backupId,
      manifestPath: manifestFilePath,
      dumpPath: dumpFilePath,
      storageSnapshotPath: storageSnapshotDir,
      manifest,
      prunedCount,
    };
  } catch (error: any) {
    logger.error({ err: error.message }, 'Backup execution failed');
    // Clean partial dump on failure
    if (fs.existsSync(dumpFilePath)) {
      try {
        fs.unlinkSync(dumpFilePath);
      } catch {}
    }
    if (fs.existsSync(storageSnapshotDir)) {
      try {
        fs.rmSync(storageSnapshotDir, { recursive: true, force: true });
      } catch {}
    }
    throw error;
  } finally {
    releaseLock(lockFilePath);
  }
}

/**
 * Prune historical backups beyond retention limits.
 * Safe retention rule: never delete current backup, never delete if fewer than retentionCount exist.
 */
export function applyRetentionPolicy(
  backupDir: string,
  retentionCount: number,
  retentionDays: number,
  currentBackupId: string
): number {
  try {
    const files = fs.readdirSync(backupDir);
    const manifestFiles = files.filter((f) => f.endsWith('.manifest.json'));

    const backupSets: Array<{
      backupId: string;
      manifestFile: string;
      timestamp: number;
    }> = [];

    for (const mFile of manifestFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(backupDir, mFile), 'utf8'));
        if (content.backupId && content.timestamp) {
          backupSets.push({
            backupId: content.backupId,
            manifestFile: mFile,
            timestamp: new Date(content.timestamp).getTime(),
          });
        }
      } catch {}
    }

    // Sort descending by timestamp (newest first)
    backupSets.sort((a, b) => b.timestamp - a.timestamp);

    // If total backups <= retentionCount, do not prune anything
    if (backupSets.length <= retentionCount) {
      return 0;
    }

    let pruned = 0;
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    // Evaluate backups beyond retentionCount
    for (let i = retentionCount; i < backupSets.length; i++) {
      const set = backupSets[i];
      // Never delete current backup
      if (set.backupId === currentBackupId) continue;

      const ageMs = now - set.timestamp;
      // Prune if count exceeds retention count OR if age exceeds retention days
      if (i >= retentionCount || ageMs > maxAgeMs) {
        logger.info({ backupId: set.backupId }, 'Pruning expired backup set according to retention policy');
        // Delete manifest
        const mPath = path.join(backupDir, set.manifestFile);
        if (fs.existsSync(mPath)) fs.unlinkSync(mPath);

        // Delete dump file
        const dumpPath = path.join(backupDir, `${set.backupId}_db.dump`);
        if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath);

        // Delete storage snapshot directory
        const storagePath = path.join(backupDir, `${set.backupId}_storage`);
        if (fs.existsSync(storagePath)) fs.rmSync(storagePath, { recursive: true, force: true });

        pruned++;
      }
    }

    return pruned;
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed during retention pruning pass');
    return 0;
  }
}

// CLI handler
if (require.main === module) {
  createBackup()
    .then((res) => {
      console.log('\n======================================================');
      console.log('              AUTOMATED BACKUP COMPLETED              ');
      console.log('======================================================');
      console.log(`Backup ID:          ${res.backupId}`);
      console.log(`Database Dump:      ${res.dumpPath} (${res.manifest.database.dumpSizeBytes} bytes)`);
      console.log(`Storage Snapshot:   ${res.storageSnapshotPath} (${res.manifest.storage.totalFiles} files)`);
      console.log(`Verified Manifest:  ${res.manifestPath}`);
      console.log(`Old Backups Pruned: ${res.prunedCount}`);
      console.log(`Status:             ${res.manifest.status}`);
      console.log('======================================================\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error(`\n[backup] ❌ Fatal Error: ${err.message}\n`);
      process.exit(1);
    });
}
