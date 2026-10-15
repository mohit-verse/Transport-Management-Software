# Shri Sanwariya Road Lines (SSRL) — Backup, Restore & Disaster Recovery Runbook

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Document Code:** SSRL-OPS-BKP-001  
**Baseline Version:** Phase 4P-E Operational Baseline  
**Date:** October 15, 2026  
**Status:** Operational Runbook  

---

## 1. Overview & Architecture

This runbook defines the operational procedures for backing up, verifying, pruning, and restoring the SSRL application database and associated physical file storage.

### Core Architecture Principles
1. **Single Source of Truth:** The PostgreSQL database is the authority for all operational records, payment ledger entries, and document metadata. Physical file storage (`documents/`, `bills/`, `templates/`) is synchronized with database records.
2. **Provider-Neutral Automation:** The backup engine (`backend/src/scripts/backup.ts`) and recovery engine (`backend/src/scripts/restore.ts`) use standard PostgreSQL client binaries (`pg_dump`, `pg_restore`) and Node.js filesystem APIs, running equivalently on bare-metal Linux, Windows Server, Docker containers, and Kubernetes pods.
3. **Cryptographic Integrity:** Backups produce a binary custom-format dump (`.dump`) and a physical storage snapshot directory, accompanied by a JSON manifest (`.manifest.json`) containing SHA-256 checksums of the database dump and every individual file.
4. **Immediate Verification:** Every backup execution automatically verifies dump readability using `pg_restore -l` before marking the manifest status as `VERIFIED`.
5. **Credential Safety:** Database credentials are never passed as command-line arguments and are sanitized (`***`) in all application logs and manifests.
6. **Concurrency Protection:** A lockfile (`.backup.lock`) containing PID and ISO timestamp prevents overlapping backup jobs, with automatic stale-lock override (> 30 minutes) if a prior process crashed ungracefully.

---

## 2. CLI Execution & Commands

The backup and restore operations are packaged as standard npm scripts in `backend/package.json`.

### 2.1 Creating a Backup

```bash
# In production environment (compiled binary):
npm run backup

# In development / staging environment (ts-node):
npm run backup:dev
```

#### Optional CLI Flags & Environment Variables
```bash
# Custom backup directory
npm run backup -- --backup-dir=/var/backups/ssrl

# Custom retention settings
npm run backup -- --retention-count=14 --retention-days=60

# Environment variables
BACKUP_DIR=/mnt/secure_backup/ssrl
BACKUP_RETENTION_COUNT=10
BACKUP_RETENTION_DAYS=30
```

#### What `createBackup` Does:
1. Acquires lockfile `.backup.lock` (rejects concurrent jobs with `BackupLockError`).
2. Generates backup identifier: `backup_YYYYMMDD_HHMMSS`.
3. Runs `pg_dump -Fc` using `PGPASSWORD` into `backup_<ID>_db.dump`.
4. Executes `pg_restore -l` to inspect the archive table of contents.
5. Snapshots `documents/`, `bills/`, and `templates/` directories into `backup_<ID>_storage/`.
6. Computes SHA-256 hashes for dump and all snapshot files.
7. Writes `backup_<ID>.manifest.json` with status `VERIFIED`.
8. Prunes older backup sets adhering strictly to retention window and minimum count.
9. Releases lockfile `.backup.lock`.

---

### 2.2 Restoring from Backup

```bash
# Restore into target database and storage using manifest:
npm run restore -- --manifest=/path/to/backup_YYYYMMDD_HHMMSS.manifest.json --target-db=ssrl_restored_db --target-storage=/var/data/ssrl/storage

# Development / test mode:
npm run restore:dev -- --manifest=/path/to/backup_YYYYMMDD_HHMMSS.manifest.json
```

#### Optional CLI Flags & Environment Variables
```bash
--manifest=/path/to/backup.manifest.json  # Full path to verified manifest file
--target-db=dbname                       # Name of the target PostgreSQL database
--target-storage=/path/to/storage        # Path to target storage root directory
--drop-existing                          # If set, recreates clean target DB if it exists
```

#### What `restoreBackup` Does:
1. Parses manifest and verifies existence of database dump and storage snapshot.
2. Checks target database; creates clean database via maintenance pool if required.
3. Executes `pg_restore --exit-on-error` into target database.
4. Restores physical files into target storage, verifying each file against manifest SHA-256.
5. Connects to restored database and verifies canonical schema completeness:
   - Exactly 40 canonical tables (`CANONICAL_TABLES_001`)
   - Exactly 27 domain functions (`CANONICAL_FUNCTIONS_001`)
   - At least 63 canonical triggers (`CANONICAL_TRIGGERS_001`)
   - At least 86 active dynamic field definitions (`CANONICAL_DYNAMIC_FIELDS_COUNT`)
6. Asserts core financial invariant:
   - `Net P&L = Active Incoming - Active Outgoing` (reversed payments contribute ₹0).
7. Executes dry-run storage reconciliation (`reconcileStorage({ dryRun: true })`):
   - Confirms 0 missing files referenced in DB.
8. Outputs comprehensive JSON and formatted terminal verification summary.

---

## 3. Scheduled Backup Configurations

The backup script should be scheduled to run automatically on the production host or orchestrator.

### 3.1 Linux Systemd Timer (Recommended for Virtual Machines)

Create service file `/etc/systemd/system/ssrl-backup.service`:
```ini
[Unit]
Description=SSRL Automated Database and Storage Backup
After=network.target postgresql.service

[Service]
Type=oneshot
User=ssrl
WorkingDirectory=/opt/ssrl/backend
EnvironmentFile=/etc/ssrl/production.env
ExecStart=/usr/bin/npm run backup
StandardOutput=journal
StandardError=journal
```

Create timer file `/etc/systemd/system/ssrl-backup.timer`:
```ini
[Unit]
Description=Trigger SSRL Backup Nightly and Keep Backups Current

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ssrl-backup.timer
sudo systemctl list-timers ssrl-backup.timer
```

---

### 3.2 Linux Crontab

Add to crontab (`crontab -e` under the application service user):
```cron
# Run SSRL backup daily at 02:00 AM UTC
0 2 * * * cd /opt/ssrl/backend && /usr/bin/npm run backup >> /var/log/ssrl/backup.log 2>&1
```

---

### 3.3 Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ssrl-nightly-backup
  namespace: ssrl-production
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup-worker
              image: ssrl-backend:production
              command: ["npm", "run", "backup"]
              envFrom:
                - secretRef:
                    name: ssrl-production-secrets
                - configMapRef:
                    name: ssrl-production-config
              volumeMounts:
                - name: persistent-storage
                  mountPath: /var/data/ssrl/storage
                - name: backup-volume
                  mountPath: /var/backups/ssrl
          volumes:
            - name: persistent-storage
              persistentVolumeClaim:
                claimName: ssrl-storage-pvc
            - name: backup-volume
              persistentVolumeClaim:
                claimName: ssrl-backup-pvc
```

---

### 3.4 Windows Task Scheduler (PowerShell)

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command `"cd 'D:\Shri Sanwariya RO\SSRL\backend'; npm run backup`""
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "SSRL_Automated_Backup" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings
```

---

## 4. Continuous WAL Archiving & Point-In-Time Recovery (PITR) Guidelines

> [!IMPORTANT]
> **Operational Objective vs Local Capability**  
> Continuous WAL Archiving and Point-In-Time Recovery (PITR) are operational objectives requiring infrastructure provisioning on the target hosting provider (e.g. AWS S3, Google Cloud Storage, Azure Blob, or dedicated network NFS). They cannot be tested as a live guarantee in local sandbox environments without selected cloud storage endpoints.

When deploying to production, configure PostgreSQL for continuous WAL streaming:

### 4.1 PostgreSQL Configuration (`postgresql.conf`)
```ini
# Enable continuous write-ahead log archiving
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /mnt/wal_archive/%f && cp %p /mnt/wal_archive/%f'
# Alternatively, for S3:
# archive_command = 'aws s3 cp %p s3://ssrl-production-wal-archive/%f'

# Force segment rotation every 10 minutes to bound RPO
archive_timeout = 600
```

### 4.2 Failure Alerting & Monitoring
- **Failed Archive Alerts:** Configure Prometheus `pg_stat_archiver` exporter or log watcher alerting on `failed_count > 0` or `last_failed_time > last_archived_time`.
- **Disk Saturation Protection:** Monitor WAL disk space (`pg_wal`); ensure `archive_command` exits with code 0 only when the segment is durably written to secondary storage.

---

## 5. Recovery Objectives & SLA Timings

### 5.1 Recovery Objectives (Target SLA)
- **Target RPO (Recovery Point Objective):**
  - **With Scheduled Nightly Backups:** $\le 24$ hours.
  - **With Continuous WAL Archiving:** $\le 15$ minutes.
- **Target RTO (Recovery Time Objective):**
  - **Full System Reconstitution (Database + Storage):** $\le 30$ minutes.

### 5.2 Measured Staging Timings (Benchmarked on Synthetic Staging Dataset)
- **Backup Creation & SHA-256 Hashing:** 1.30 seconds.
- **Archive Table of Contents Verification (`pg_restore -l`):** 0.07 seconds.
- **Clean Database Creation & Full `pg_restore`:** 3.46 seconds.
- **Physical File Copy & Checksum Validation:** 0.02 seconds.
- **Complete Schema & Invariant Audit:** 0.32 seconds.
- **Total Recovery Rehearsal Duration:** **4.85 seconds** (well within the 30-minute target RTO).

---

## 6. Retention & Pruning Policy

The backup engine enforces a strict two-tier retention policy:
1. **Time-Based Window (`BACKUP_RETENTION_DAYS`):** Backups older than the configured threshold (default: 30 days) are evaluated for pruning.
2. **Guaranteed Minimum Count (`BACKUP_RETENTION_COUNT`):** Pruning will **never** delete backups if doing so would reduce the total number of retained backups below the minimum count threshold (default: 5 backups).
3. **Current Backup Protection:** The backup set generated in the active execution is never pruned, regardless of age or count.
4. **Atomic Deletion:** The manifest (`.manifest.json`), PostgreSQL dump (`.dump`), and storage snapshot directory (`_storage/`) are pruned together as an atomic unit.
