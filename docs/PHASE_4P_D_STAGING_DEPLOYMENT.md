# Phase 4P-D & 4P-D.1 — Staging Deployment & Operational Runbook Execution Report

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Repository:** `d:\Shri Sanwariya RO\SSRL`  
**Date:** October 15, 2026  
**Status:** Complete (Phase 4P-D & 4P-D.1 Closed)  
**Verdict:** **PASS WITH GAPS** (All operational, schema, restoration, and process lifecycle criteria verified 100% without `--forceExit`; Host-level automated background cron, continuous WAL archiving, PVC multi-node verification, and UI settings/notifications accepted as deployment gaps)

---

## 1. Executive Summary

Phase 4P-D and Phase 4P-D.1 executed an end-to-end, isolated staging deployment and operational runbook rehearsal for the SSRL application using synthetic business data and isolated staging infrastructure.

### Verification Highlights
- **Staging Database:** Dedicated PostgreSQL database (`ssrl_staging_db`) migrated cleanly with 40 canonical tables, 27 domain functions, 63 triggers, and 86 active canonical dynamic field definitions.
- **POD Canonical Schema Resolution:** Established that `trip_pods` is the single canonical schema table defined in `001_initial_schema.sql` and `CANONICAL_TABLES_001`. Resolved errant documentation references to `pod_details` (which does not exist and is strictly rejected by regression checks).
- **Staging Storage:** Isolated persistent directory (`storage/staging`) verifying strict path traversal prevention, POD uploads, physical PDF snapshots, and 0 missing files / 0 orphan files in storage reconciliation.
- **Compiled Production Binary:** Spun up compiled binary (`node dist/server.js`) on port 3001 in `production` mode with Helmet security headers (HSTS, nosniff, frame-ancestors) and strict CORS filtering.
- **Natural Process Exit Without `--forceExit`:** Fully eliminated leaked handles, open TCP sockets, and unmanaged processes:
  - Express server calls `server.closeIdleConnections()` on SIGTERM with an unref'd forced timeout fallback.
  - HTTP requests utilize `stagingFetch` with explicit `Connection: close` headers to prevent Node global fetch connection-pool keep-alive socket leaks.
  - Suite exits naturally in 16.82s without `--forceExit`.
- **Targeted Process & Safe Port Management:**
  - Suite-spawned processes are tracked via `spawnedProcs.add(proc)` ensuring teardown only touches child processes belonging to this test.
  - `verifyPortFree(3001)` verifies listening process command line; only terminates stale SSRL instances (`dist/server.js`) and aborts with an informative error if an unrelated service occupies the port.
  - Exit statuses and signals are captured during graceful shutdown before forced termination fallback.
- **Multi-Role RBAC:** Validated token generation and permissions for `OWNER`, `STAFF`, and `CA`:
  - `OWNER` has full administrative, billing, document, and reversal access.
  - `STAFF` is permitted operational create/edit but blocked with HTTP 403 on payment reversal.
  - `CA` receives HTTP 403 on mutations (e.g. trip creation) while retaining read-only access (HTTP 200) to financial reports and documents.
- **Full Operational Lifecycle:** End-to-end execution of Party, Vehicle Owner, Market Vehicle, and Own Fleet Vehicle creation, Trip execution and completion, POD upload and streaming, Payment recording with exact allocation and excess credit generation, Bill generation with numbering series incrementation and versioned PDF generation, and authoritative payment-based Net P&L reporting.
- **Full Database Restoration into Disposable Database:**
  - Created binary custom-format backup (`pg_dump -Fc`).
  - Restored into a clean, disposable PostgreSQL database (`ssrl_staging_restore_test_db`) using `pg_restore --exit-on-error`.
  - Re-verified all 40 canonical tables, 27 domain functions, 63 triggers, migration history, 86 dynamic field definitions, operational business records, payment-based Net P&L (₹70,000), party credits (₹20,000), and physical storage links on disk.
  - Cleanly dropped disposable database and removed temporary dump file.
- **Process Lifecycle & Rollback:** Clean process shutdown and restart simulated; all persistent data and security tokens survived cleanly.
- **Testing Results:**
  - **Staging Test Suite (`staging-deployment.test.ts`):** 23 / 23 tests passing naturally without `--forceExit`.
  - **Backend Regression Suite:** 21 / 21 test suites passing, 310 / 310 tests passing.
  - **Frontend Regression Suite:** 31 / 31 test files passing, 119 / 119 tests passing.
  - **Frontend Production Build:** `tsc -b && vite build` succeeded in 2.07s.
  - **Backend Production Build:** `tsc -p tsconfig.build.json` succeeded cleanly.

---

## 2. Root Cause Analysis & Verification Closure Findings

### 2.1 Own Fleet Database Schema Mismatch (`of.service.ts`)
- *Problem:* `createVehicle` attempted to bind non-existent columns (`vehicle_type`, `capacity_tonnage`, `purchase_date`), and queries referenced non-existent columns (`is_sold_removed`, `is_under_maintenance`, `trip_status`). In PostgreSQL with `pg`, passing `undefined` parameters throws `Bind parameters must not contain undefined`.
- *Resolution:* Aligned `of.service.ts` with canonical `own_fleet_vehicles` schema (`vehicle_number`, `manual_state`, `maintenance_notes`, `is_active`) and `trips.status`.

### 2.2 Trip Creation & Status Update Schema Mismatch (`trips.service.ts`)
- *Problem:* `createTrip` omitted required `trip_number`, `created_by`, `status`, and mapped destinations to `destination_order, origin, destination` instead of `sequence_no, from_location, to_location`. `updateStatus` attempted to update non-existent column `trip_status` instead of `status`. This prevented trips from transitioning to `COMPLETED` and blocked subsequent bill generation.
- *Resolution:* Fixed column names across `trips`, `trip_destinations`, and `trip_pods` (`pod_status = 'PENDING'`), and fixed `updateStatus` query to `UPDATE trips SET status = $2`.

### 2.3 Bill Object Response & Document Reference (`bills.service.ts` & `reconcile-storage.ts`)
- *Problem:* `generateBill` returned `{ bill, version }`, but the test inspected `billBody.data.id`. Additionally, `bill_versions` insert omitted `document_reference`, causing `reconcileStorage` to treat the generated bill PDF as an orphan file.
- *Resolution:* Populated `document_reference` (`bills/${bill.id}/v1.pdf`) in `bill_versions`, updated `reconcile-storage.ts` to recognize canonical bill version paths, and unwrapped `billBody.data?.bill || billBody.data` in the test.

### 2.4 Payment Status Column Check (`staging-deployment.test.ts`)
- *Problem:* The test asserted `payBody.data.status === 'ACTIVE'`, whereas the canonical database column name returned by the payment service is `payment_status`.
- *Resolution:* Updated assertion to `expect(payBody.data.payment_status).toBe('ACTIVE')`.

### 2.5 POD Canonical Schema Discrepancy Resolution
- *Problem:* Historical reports referenced `pod_details`, raising concern over whether an unmigrated table or view existed.
- *Investigation:* Audited `001_initial_schema.sql`, `CANONICAL_TABLES_001`, `trips.service.ts`, and `documents.service.ts`. Established that `trip_pods` is the sole canonical table in the SSRL data model, with columns:
  - `id`, `trip_id`, `pod_status`, `docket_number`, `courier_partner`, `pod_received_at`, `sent_to_party_at`, `notes`, `created_at`, `updated_at`.
- *Resolution & Regression Guard:* Verified that `pod_details` does not exist in PostgreSQL. Added explicit schema regression assertions in `staging-deployment.test.ts` verifying all 10 columns of `trip_pods`, verifying `pod_details` does not exist, and asserting that queries referencing `pod_details` or non-existent columns in `trip_pods` are strictly rejected by the database engine.

### 2.6 Leaked Handle Elimination & Graceful Process Lifecycle
- *Problem:* The test runner previously required `--forceExit` to terminate, which could mask leaked handles or surviving child processes.
- *Investigation:* Identified that Node's global `fetch` maintains an internal socket pool with keep-alive connections to the HTTP server, and Express keep-alive sockets remain open unless explicitly closed.
- *Resolution:*
  1. Updated `backend/src/server.ts` to execute `server.closeIdleConnections()` during shutdown, followed by `server.close()` with an unref'd force-exit timeout.
  2. Implemented `stagingFetch` helper adding `Connection: close` header on all HTTP requests to prevent socket pooling.
  3. Replaced naive port clearing with `verifyPortFree(3001)`, which inspects the listening process command line via `Win32_Process` (or `lsof` on POSIX) and only kills verified SSRL instances (`dist/server.js`), while refusing to touch unrelated services.
  4. Tracked all spawned processes in `spawnedProcs: Set<ChildProcess>` and implemented `stopProcessGracefully` capturing exit statuses and signals.
  5. Verified the suite exits naturally without `--forceExit` in 16.82s.

---

## 3. Staging Infrastructure & Environment Specification

The staging environment was isolated from development and production environments:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://postgres@localhost:5432/ssrl_staging_db
JWT_SECRET=staging_environment_test_jwt_secret_key_at_least_32_chars
STORAGE_DIR=D:\Shri Sanwariya RO\SSRL\storage\staging
CORS_ORIGIN=http://localhost:5173,https://staging.ssrl.in
LOG_LEVEL=info
```

### Filesystem Storage Layout
```
storage/staging/
├── documents/       # PODs, LR copies, vehicle documents
├── bills/           # Versioned generated bill PDFs (e.g. bills/<id>/v1.pdf)
└── templates/       # Bill Designer assets (logos, signatures, stamps)
```

---

## 4. Test Evidence & Runbook Execution

### 4.1 Staging Deployment Test Suite (`tests/staging-deployment.test.ts`)
*Executed without `--forceExit`, natural process exit:*
```
PASS tests/staging-deployment.test.ts (16.25 s)
  Phase 4P-D: Staging Deployment & Operational Runbook Execution
    1. Staging Environment & Packaging Configuration Validation
      √ accepts valid staging production configuration via parseEnv (4 ms)
      √ rejects missing STORAGE_DIR or wildcard CORS in production mode (1 ms)
      √ initializes persistent LocalStorageService on staging directory with path traversal protection (6 ms)
    2. Staging Database Migration & Schema Completeness
      √ verifies all 40 canonical tables, 27 domain functions, and 63 triggers exist in staging DB (19 ms)
      √ verifies trip_pods canonical schema and rejects nonexistent pod_details references (110 ms)
    3. Staging Live HTTP Service Probing (dist/server.js on Port 3001)
      √ responds to GET /api/health with HTTP 200 and healthy DB connection (15 ms)
      √ enforces Helmet security headers (HSTS, nosniff, frame-ancestors) (15 ms)
      √ enforces strict CORS rules for allowed vs unauthorized origins (16 ms)
    4. Staging Authentication & Multi-Role RBAC Authorization Matrix
      √ authenticates Owner user and returns valid Bearer token (187 ms)
      √ authenticates Staff and CA users and returns role-scoped tokens (264 ms)
      √ rejects unauthenticated requests to protected API endpoints with HTTP 401 (8 ms)
      √ rejects CA mutation requests (POST /api/trips) with HTTP 403 Forbidden (9 ms)
      √ permits CA read access to financial report endpoints with HTTP 200 (21 ms)
    5. Synthetic Operational Lifecycle Execution on Staging
      √ creates Party, Vehicle Owner, Market Vehicle, and Own Fleet Vehicle (80 ms)
      √ creates Trip with destinations and updates financial obligations (106 ms)
      √ uploads POD document, writes to storage/staging/documents, and streams via secure file API (58 ms)
      √ records Incoming Payment with complete allocation to Trip and excess credit generation (175 ms)
      √ prohibits Staff from reversing Payment with HTTP 403 Forbidden (11 ms)
      √ generates Bill, generates PDF snapshot in staging storage, and derives PAID status (237 ms)
      √ reflects authoritative payment-based Net P&L in financial reports (9 ms)
    6. Staging Persistent Storage Reconciliation & Backup Verification
      √ executes storage reconciliation dry-run and confirms 0 missing files and 0 orphans (56 ms)
      √ creates binary pg_dump backup of staging database, restores into disposable database with pg_restore --exit-on-error, and validates schema, records, invariants, and storage references (3628 ms)
    7. Process Lifecycle, Graceful Shutdown & Rollback Simulation
      √ stops staging service cleanly and restarts verifying persistent data survival (1304 ms)

Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        16.82 s, estimated 21 s
Ran all test suites matching tests/staging-deployment.test.ts.
```

### 4.2 Full Backend Regression Suite
```
Test Suites: 21 passed, 21 total
Tests:       310 passed, 310 total
Snapshots:   0 total
Time:        72.37 s
```

### 4.3 Frontend Regression Suite & Production Build
```
Test Files:  31 passed, 31 total
Tests:       119 passed, 119 total
Time:        116.13 s
Build:       vite v8.3.2 client production build succeeded in 2.07s (dist/assets/index-DLLCa3Qy.js 805.99 kB).
Lint:        0 errors (23 warnings on hooks and fast-refresh).
```

---

## 5. Operational Procedures & Runbooks

### 5.1 Deployment Runbook (Staging / Production)
1. **Pre-flight Checks:**
   - Verify PostgreSQL service is active and listening.
   - Verify environment variables conform to `envSchema` (`DATABASE_URL`, `JWT_SECRET` >= 32 chars, absolute `STORAGE_DIR`, strict `CORS_ORIGIN`).
2. **Database Migration:**
   - Execute `npm run migrate` (runs `node dist/scripts/migrate.js`).
   - Runner verifies canonical tables and 86 dynamic field definitions.
3. **Initial User Seed:**
   - Execute `npm run seed:owner` with environment credentials (`INITIAL_OWNER_NAME`, `INITIAL_OWNER_MOBILE`, `INITIAL_OWNER_PASSWORD`).
4. **Compile & Package:**
   - In backend: `npm run build` (`tsc -p tsconfig.build.json`).
   - In frontend: `npm run build` (`tsc -b && vite build`).
5. **Start Production Service:**
   - Execute `npm start` (`node dist/server.js`).
   - Probe `GET /api/health` to confirm HTTP 200 with `{ "status": "UP", "database": "UP" }`.

### 5.2 Rollback Runbook
If a newly deployed build fails health checks or exhibits regressions:
1. **Stop Node.js Service:**
   - Windows: `taskkill /pid <PID> /F /T` or stop SSRL service.
   - Linux: `systemctl stop ssrl-backend`.
2. **Revert Artifacts:**
   - Point application launcher to previous `dist/` directory or check out previous stable Git tag.
3. **Database State Verification:**
   - Check `schema_migrations` tracking table:
     ```sql
     SELECT id, applied_at FROM schema_migrations ORDER BY applied_at DESC;
     ```
   - Schema objects are append-only. No destructive column drops are performed during releases.
4. **Restart & Validate:**
   - Launch previous binary: `node dist/server.js`.
   - Probe `GET /api/health` and verify HTTP 200.

### 5.3 Backup & Storage Reconciliation Runbook
1. **Database Backup:**
   ```bash
   pg_dump -Fc -h localhost -p 5432 -U postgres -d ssrl_db -f /backups/ssrl_db_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Physical Storage Sync:**
   - Synchronize `storage/documents`, `storage/bills`, and `storage/templates` to off-site backup storage.
3. **Storage Reconciliation Audit:**
   - Execute `npm run reconcile:storage` to audit storage integrity against database records. Confirm 0 missing files and 0 orphan files.

---

## 6. Persistence Boundary & Operational Scope Clarification

### 6.1 Process Restart vs Host/PVC Replacement Boundary
- **Verified by Staging Suite:**
  - **Process-Level Restarts:** Survives gracefully without data loss. Database rows, active JWT tokens, numbering series counters, and filesystem assets remain persistent across `node dist/server.js` stop and restart cycles.
  - **Storage Directory Integrity:** Validated across local disk paths (`storage/staging`). Path traversal is blocked, file hashes match between write and read cycles, and reconciliation confirms 0 missing and 0 orphan files.
- **Not Verified in Local Staging (Host/Cloud Boundary):**
  - **Persistent Volume Claim (PVC) Detach/Reattach:** In Kubernetes or multi-instance container environments (e.g. AWS EKS, GCP GKE), persistent volumes require verified `ReadWriteMany` (RWX) or single-node volume affinity (`ReadWriteOnce`). Testing in local Windows staging validates host filesystem storage, but cannot prove multi-pod cloud storage mount behavior.
  - **Host Replacement:** A physical host death requires an out-of-band persistent disk (SAN, EBS, Google Persistent Disk) or backup restoration.

### 6.2 Accepted Backlog & Deployment Gaps
The following non-blocking operational controls are formally accepted as deployment gaps:
1. **Automated Host-Level Backup Orchestration:**
   - `pg_dump -Fc` and `pg_restore --exit-on-error` are fully verified via CLI and tests. However, automated scheduling (Windows Task Scheduler / Linux Cron) must be provisioned on the production host.
2. **Continuous WAL Archiving & Point-In-Time Recovery (PITR):**
   - For continuous backup and PITR, PostgreSQL `archive_mode = on` and `archive_command` must be configured in `postgresql.conf` on the production server.
3. **Settings Module UI Placeholders:**
   - `/settings/system` and `/settings/users` remain placeholder pages; users are provisioned via seeds and CLI.
4. **Visual Notification Bell:**
   - Real-time notification engine remains a post-release backlog item.

---

## 7. Production Deployment Approval Gate

> [!CAUTION]
> **PRODUCTION DEPLOYMENT GATE: LOCKED**  
> Production deployment must **NOT** be executed without explicit written authorization from the system Owner. All changes in this phase were executed strictly against staging databases (`ssrl_staging_db`, `ssrl_staging_restore_test_db`) and isolated staging storage (`storage/staging`). No production systems or live data were touched.

