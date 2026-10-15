# Shri Sanwariya Road Lines (SSRL) — Incident Response & Disaster Recovery Runbook

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Document Code:** SSRL-OPS-INC-001  
**Baseline Version:** Phase 4P-E Operational Baseline  
**Date:** October 15, 2026  
**Status:** Operational Runbook  

---

## 1. Incident Severity Classification

| Severity Level | Definition | Response SLA | Target Resolution SLA | Escalation Target |
|---|---|---|---|---|
| **SEV-1 (Critical)** | Core service down, complete database outage, primary storage inaccessible, or financial ledger corruption affecting business operations. | Immediate ($\le 15$ mins) | $\le 1$ hour | Business Owner, Lead Engineer, System Architect |
| **SEV-2 (Major)** | Major functionality impaired (e.g. billing generation blocked, POD upload failures, payment allocation failures) with no immediate workaround. | $\le 30$ mins | $\le 4$ hours | Lead Engineer, QA Lead |
| **SEV-3 (Moderate)** | Non-critical operational failure, degraded performance, single non-blocking API endpoint error, or individual document download issue. | $\le 2$ hours | $\le 24$ hours | Senior Developer |
| **SEV-4 (Minor)** | Minor UI layout glitch, cosmetic label discrepancy, or non-blocking report formatting issue. | $\le 1$ business day | Next maintenance release | Development Team |

---

## 2. Escalation Matrix & Incident Roles

```
[Incident Reporter (Staff / CA / User)]
                 │
                 ▼
[Technical Lead / Incident Commander] ─── (SEV-1 / SEV-2) ───► [Business Owner]
                 │                                                    │
                 ├────────────────────────────────────────────────────┤
                 ▼                                                    ▼
   [Database & Storage Lead]                                [Chartered Accountant]
   (PostgreSQL / Filesystem)                                (Financial Verification)
```

- **Incident Commander (Lead Engineer / Owner):** Directs triage, authorizes emergency rollbacks, approves database restoration, and manages stakeholder communication.
- **Database / Infrastructure Lead:** Executes database diagnostics, failover, backup restoration, and storage volume repair.
- **Financial Reviewer (CA / Owner):** Validates post-restoration financial invariants: Net P&L integrity, party credits, and payment allocation reconciliation.

---

## 3. Diagnostic & Resolution Workflows

### 3.1 Scenario A: Database Unavailability or Corruption

#### Symptoms:
- `GET /api/health` returns HTTP 503 (`{ status: 'error', database: 'disconnected' }`).
- PostgreSQL logs indicate FATAL connection refusal, I/O errors, or corrupted blocks.

#### Immediate Response Steps:
1. **Check Service & Process Status:**
   ```bash
   # On Linux:
   sudo systemctl status postgresql
   # On Windows / Docker:
   docker ps | grep postgres
   ```
2. **Inspect Storage & Disk Space:**
   ```bash
   df -h /var/lib/postgresql/data
   ```
   If disk is 100% full, increase volume capacity or prune non-critical application logs (never prune WAL or database data files).
3. **If Database Cluster is Unrecoverable (Corruption / Hardware Loss):**
   - Declare **SEV-1**.
   - Identify the latest verified backup manifest in the backup directory:
     ```bash
     ls -lt /var/backups/ssrl/*.manifest.json | head -n 1
     ```
   - Execute automated restoration into a clean database target:
     ```bash
     npm run restore -- --manifest=/var/backups/ssrl/backup_YYYYMMDD_HHMMSS.manifest.json --target-db=ssrl_recovery_db --target-storage=/var/data/ssrl/storage
     ```
   - Verify restoration output:
     - All 40 canonical tables verified.
     - All 27 domain functions verified.
     - At least 63 triggers verified.
     - Net P&L matches expected figure.
     - 0 missing storage files.
   - Point application to restored database:
     - Update `DATABASE_URL` in `/etc/ssrl/production.env`.
     - Restart application service: `sudo systemctl restart ssrl-backend`.

---

### 3.2 Scenario B: Storage Volume Unmount or Missing Files

#### Symptoms:
- Secure file downloads return HTTP 404 (`File not found on storage provider`).
- Storage volume mount is empty or read-only (`EROFS`).

#### Immediate Response Steps:
1. **Check Filesystem Mount:**
   ```bash
   mount | grep ssrl
   ls -la /var/data/ssrl/storage
   ```
2. **Run Storage Reconciliation Engine (Dry-Run):**
   ```bash
   node dist/scripts/reconcile-storage.js --dry-run
   ```
   Inspect stdout for `missingFiles` and `orphanFiles`.
3. **Restoring Storage from Snapshot:**
   - Locate the matching backup snapshot directory: `/var/backups/ssrl/backup_<ID>_storage`.
   - Restore missing subdirectories into production storage:
     ```bash
     rsync -avz --ignore-existing /var/backups/ssrl/backup_<ID>_storage/ /var/data/ssrl/storage/
     ```
   - Re-run reconciliation to certify 0 missing files:
     ```bash
     node dist/scripts/reconcile-storage.js --dry-run
     ```

---

### 3.3 Scenario C: Application Crash Loop / Restart Loop

#### Symptoms:
- Process supervisor (systemd / Docker / Kubernetes) repeatedly restarts `ssrl-backend`.
- Exit code $\ne 0$.

#### Immediate Response Steps:
1. **Inspect Application Startup Logs:**
   ```bash
   journalctl -u ssrl-backend.service -n 100 --no-pager
   # Or Docker:
   docker logs --tail 100 ssrl-backend
   ```
2. **Common Startup Abort Causes:**
   - **Environment Validation Failure (`ZodError`):** Missing or invalid production environment variables (e.g. `JWT_SECRET < 32 chars`, wildcard `CORS_ORIGIN=*`, missing `STORAGE_DIR`). Fix environment file.
   - **Database Connection Refusal:** PostgreSQL is not ready when backend starts. Ensure service dependency `After=postgresql.service` or container restart policy handles transient boot skew.
   - **Port Collision (EADDRINUSE):** Another process occupies `PORT` (default: 3001). Check listening process:
     ```bash
     ss -tulpn | grep 3001
     ```

---

### 3.4 Scenario D: Migration Interruption or Partial Schema State

#### Symptoms:
- Backend startup aborts with `Incomplete canonical schema detected`.
- `migrate.ts` aborts because core tables or dynamic fields are incomplete.

#### Immediate Response Steps:
1. **Never Manually Drop Canonical Tables:**
   - The SSRL database schema contains append-only triggers and core referential constraints.
2. **Inspect Migration Log:**
   ```bash
   npm run migrate:dev
   ```
3. **If Migration Failed Mid-Execution:**
   - Since migration files run in explicit transactions (`BEGIN ... COMMIT`), a failed migration rolls back cleanly.
   - Fix underlying SQL syntax or permission defect in the migration script.
   - Re-run `npm run migrate`.

---

## 4. Emergency Rollback Procedure

When a bad deployment, corrupted release, or catastrophic configuration defect occurs:

```
[Trigger Rollback]
        │
        ├─ 1. Stop Incoming Traffic (Set Reverse Proxy to Maintenance Mode)
        │
        ├─ 2. Stop Application Services (`systemctl stop ssrl-backend`)
        │
        ├─ 3. Restore Database & Storage from Pre-Deployment Manifest
        │
        ├─ 4. Run Automated Verification (Schema, Invariants, Reconciliation)
        │
        ├─ 5. Deploy Previous Stable Application Binary (Release Tag)
        │
        ├─ 6. Validate `/api/health` and Owner Login
        │
        └─ 7. Restore Traffic & Clear Reverse Proxy Maintenance Mode
```

### 4.1 Step-by-Step Rollback Commands
1. **Drain Traffic:**
   Point Nginx / Cloudflare to `/etc/nginx/maintenance.html` (`503 Service Unavailable`).
2. **Stop Backend:**
   ```bash
   sudo systemctl stop ssrl-backend
   ```
3. **Execute Target Database Restoration:**
   ```bash
   npm run restore -- --manifest=/var/backups/ssrl/pre_deploy_backup.manifest.json --target-db=ssrl_production --drop-existing
   ```
4. **Checkout Previous Stable Release Binary:**
   ```bash
   cd /opt/ssrl/backend
   git checkout <PREVIOUS_STABLE_TAG>
   npm install --omit=dev
   ```
5. **Start Application & Verify:**
   ```bash
   sudo systemctl start ssrl-backend
   curl -I http://localhost:3001/api/health
   # Must return HTTP 200 OK
   ```
6. **Re-Enable Live Traffic:**
   Restore Nginx configuration and reload: `sudo systemctl reload nginx`.

---

## 5. Post-Incident Review & RCA Template

Every SEV-1 and SEV-2 incident requires a completed Post-Mortem within 48 hours:

```markdown
# Incident Post-Mortem: [INC-YYYYMMDD-TITLE]

## 1. Summary
- **Date & Time:**
- **Duration of Outage:**
- **Severity Level:** (SEV-1 / SEV-2)
- **Incident Commander:**
- **Customer Impact:**

## 2. Root Cause Analysis (5 Whys)
1. Why did the outage occur?
2. Why was it not caught in staging?
3. Why did the recovery take [X] minutes?
...

## 3. Timeline of Events (UTC)
- **HH:MM:** Alert fired / failure detected.
- **HH:MM:** Triage started.
- **HH:MM:** Rollback / restore initiated.
- **HH:MM:** Canonical schema and Net P&L verified.
- **HH:MM:** Traffic restored.

## 4. Corrective & Preventative Actions
- [ ] Action item 1 (Owner, Due Date)
- [ ] Action item 2 (Owner, Due Date)
```
