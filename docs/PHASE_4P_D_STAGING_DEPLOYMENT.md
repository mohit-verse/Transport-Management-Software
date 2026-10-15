# Phase 4P-D — Staging Deployment & Operational Runbook Execution Report

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Repository:** `d:\Shri Sanwariya RO\SSRL`  
**Date:** October 15, 2026  
**Status:** Complete  
**Verdict:** **PASS WITH GAPS** (Operational verification passed 100%; Automated background cron orchestration accepted as deployment gap)

---

## 1. Executive Summary

Phase 4P-D executed a complete, isolated staging deployment and operational runbook rehearsal for the SSRL application using synthetic business data and isolated staging infrastructure.

### Verification Highlights
- **Staging Database:** Dedicated PostgreSQL database (`ssrl_staging_db`) migrated cleanly with 40 canonical tables, 27 domain functions, 63 triggers, and 86 active canonical dynamic field definitions.
- **Staging Storage:** Isolated persistent directory (`storage/staging`) verifying strict path traversal prevention, POD uploads, physical PDF snapshots, and 0 missing files / 0 orphan files in storage reconciliation.
- **Compiled Production Binary:** Spun up compiled binary (`node dist/server.js`) on port 3001 in `production` mode with Helmet security headers (HSTS, nosniff, frame-ancestors) and strict CORS filtering.
- **Multi-Role RBAC:** Validated token generation and permissions for `OWNER`, `STAFF`, and `CA`:
  - `OWNER` has full administrative, billing, document, and reversal access.
  - `STAFF` is permitted operational create/edit but blocked with HTTP 403 on payment reversal.
  - `CA` receives HTTP 403 on mutations (e.g. trip creation) while retaining read-only access (HTTP 200) to financial reports and documents.
- **Full Operational Lifecycle:** End-to-end execution of Party, Vehicle Owner, Market Vehicle, and Own Fleet Vehicle creation, Trip execution and completion, POD upload and streaming, Payment recording with exact allocation and excess credit generation, Bill generation with numbering series incrementation and versioned PDF generation, and authoritative payment-based Net P&L reporting.
- **Process Lifecycle & Rollback:** Clean process shutdown and restart simulated; all persistent data and security tokens survived cleanly.
- **Testing Results:**
  - **Staging Test Suite (`staging-deployment.test.ts`):** 22 / 22 tests passing.
  - **Backend Regression Suite:** 21 / 21 test suites passing, 309 / 309 tests passing.
  - **Frontend Regression Suite:** 31 / 31 test files passing, 119 / 119 tests passing.
  - **Frontend Production Build:** `tsc -b && vite build` succeeded in 2.33s.
  - **Backend Production Build:** `tsc -p tsconfig.build.json` succeeded cleanly.

---

## 2. Root Cause Analysis of Previous Test Failures & Process Hanging

During the initial staging test run, the test suite failed on Section 5 and Section 6, and Node processes remained alive without closing automatically. A root cause analysis identified five specific defects:

1. **Own Fleet Database Schema Mismatch (`of.service.ts`):**
   - *Problem:* `createVehicle` attempted to bind non-existent columns (`vehicle_type`, `capacity_tonnage`, `purchase_date`), and queries referenced non-existent columns (`is_sold_removed`, `is_under_maintenance`, `trip_status`). In PostgreSQL with `pg`, passing `undefined` parameters throws `Bind parameters must not contain undefined`.
   - *Resolution:* Aligned `of.service.ts` with canonical `own_fleet_vehicles` schema (`vehicle_number`, `manual_state`, `maintenance_notes`, `is_active`) and `trips.status`.
2. **Trip Creation & Status Update Schema Mismatch (`trips.service.ts`):**
   - *Problem:* `createTrip` omitted required `trip_number`, `created_by`, `status`, and mapped destinations to `destination_order, origin, destination` instead of `sequence_no, from_location, to_location`. `updateStatus` attempted to update non-existent column `trip_status` instead of `status`. This prevented trips from transitioning to `COMPLETED` and blocked subsequent bill generation.
   - *Resolution:* Fixed column names across `trips`, `trip_destinations`, and `trip_pods` (`pod_status = 'PENDING'`), and fixed `updateStatus` query to `UPDATE trips SET status = $2`.
3. **Bill Object Response & Document Reference (`bills.service.ts` & `reconcile-storage.ts`):**
   - *Problem:* `generateBill` returned `{ bill, version }`, but the test inspected `billBody.data.id`. Additionally, `bill_versions` insert omitted `document_reference`, causing `reconcileStorage` to treat the generated bill PDF as an orphan file.
   - *Resolution:* Populated `document_reference` (`bills/${bill.id}/v1.pdf`) in `bill_versions`, updated `reconcile-storage.ts` to recognize canonical bill version paths, and unwrapped `billBody.data?.bill || billBody.data` in the test.
4. **Payment Status Column Check (`staging-deployment.test.ts`):**
   - *Problem:* The test asserted `payBody.data.status === 'ACTIVE'`, whereas the canonical database column name returned by the payment service is `payment_status`.
   - *Resolution:* Updated assertion to `expect(payBody.data.payment_status).toBe('ACTIVE')`.
5. **Node Subprocess Hanging & Port Lingering:**
   - *Problem:* The test spawned `dist/server.js` with `stdio: 'pipe'`, which kept parent I/O handles open indefinitely. On Windows, child processes were not terminated with process tree termination (`taskkill /F /T`), causing zombie Node processes to hold port 3001.
   - *Resolution:* Switched spawn to `stdio: 'ignore'`, introduced `freePort()` and `killProc()` using Windows `taskkill /pid <PID> /T /F`, ensured `restartedProcess` was suite-scoped for cleanup in `afterAll`, and configured `--forceExit` to guarantee clean CLI exit.

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
```
PASS tests/staging-deployment.test.ts (23.447 s)
  Phase 4P-D: Staging Deployment & Operational Runbook Execution
    1. Staging Environment & Packaging Configuration Validation
      √ accepts valid staging production configuration via parseEnv (13 ms)
      √ rejects missing STORAGE_DIR or wildcard CORS in production mode (4 ms)
      √ initializes persistent LocalStorageService on staging directory with path traversal protection (15 ms)
    2. Staging Database Migration & Schema Completeness
      √ verifies all 40 canonical tables, 27 domain functions, and 63 triggers exist in staging DB (42 ms)
    3. Staging Live HTTP Service Probing (dist/server.js on Port 3001)
      √ responds to GET /api/health with HTTP 200 and healthy DB connection (26 ms)
      √ enforces Helmet security headers (HSTS, nosniff, frame-ancestors) (10 ms)
      √ enforces strict CORS rules for allowed vs unauthorized origins (18 ms)
    4. Staging Authentication & Multi-Role RBAC Authorization Matrix
      √ authenticates Owner user and returns valid Bearer token (293 ms)
      √ authenticates Staff and CA users and returns role-scoped tokens (351 ms)
      √ rejects unauthenticated requests to protected API endpoints with HTTP 401 (9 ms)
      √ rejects CA mutation requests (POST /api/trips) with HTTP 403 Forbidden (14 ms)
      √ permits CA read access to financial report endpoints with HTTP 200 (30 ms)
    5. Synthetic Operational Lifecycle Execution on Staging
      √ creates Party, Vehicle Owner, Market Vehicle, and Own Fleet Vehicle (158 ms)
      √ creates Trip with destinations and updates financial obligations (214 ms)
      √ uploads POD document, writes to storage/staging/documents, and streams via secure file API (120 ms)
      √ records Incoming Payment with complete allocation to Trip and excess credit generation (158 ms)
      √ prohibits Staff from reversing Payment with HTTP 403 Forbidden (7 ms)
      √ generates Bill, generates PDF snapshot in staging storage, and derives PAID status (404 ms)
      √ reflects authoritative payment-based Net P&L in financial reports (9 ms)
    6. Staging Persistent Storage Reconciliation & Backup Verification
      √ executes storage reconciliation dry-run and confirms 0 missing files and 0 orphans (71 ms)
      √ creates binary pg_dump backup of staging database and verifies storage SHA-256 integrity (1252 ms)
    7. Process Lifecycle, Graceful Shutdown & Rollback Simulation
      √ stops staging service cleanly and restarts verifying persistent data survival (3624 ms)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
Time:        24.265 s
```

### 4.2 Full Backend Regression Suite
```
Test Suites: 21 passed, 21 total
Tests:       309 passed, 309 total
Snapshots:   0 total
Time:        121.67 s
```

### 4.3 Frontend Regression Suite & Production Build
```
Test Files:  31 passed, 31 total
Tests:       119 passed, 119 total
Time:        78.03 s
Build:       vite v8.3.2 client production build succeeded in 2.33s.
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

## 6. Accepted Backlog & Operational Gaps

The following non-blocking items are formally tracked as deployment gaps:
1. **Automated Host-Level Backup Orchestration:**
   - While manual `pg_dump` and storage reconciliation procedures are validated and documented, host-level automated job scheduling (e.g. Windows Task Scheduler / Linux Cron) must be provisioned on the final production host.
2. **Continuous WAL Archiving:**
   - For point-in-time recovery (PITR), PostgreSQL `archive_mode` and `archive_command` must be configured on the production host.
3. **Settings Module UI Placeholders:**
   - `/settings/system` and `/settings/users` remain placeholder pages; user provisioning is managed via seeds and CLI.
4. **Visual Notification Bell:**
   - Real-time notification engine remains a post-release backlog item.

---

## 7. Production Deployment Approval Gate

> [!CAUTION]
> **PRODUCTION DEPLOYMENT GATE: LOCKED**  
> Production deployment must **NOT** be executed without explicit written authorization from the system Owner. All changes in this phase were executed strictly against staging databases (`ssrl_staging_db`) and isolated staging storage (`storage/staging`). No production systems or live data were touched.
