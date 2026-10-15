# Phase 4P-A — Deployment Audit & Production Readiness Assessment

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Repository:** `D:\Shri Sanwariya RO\SSRL`  
**Date:** October 15, 2026  
**Auditor:** Antigravity (Advanced Agentic Coding Pair Programmer)  
**Baseline Verified:** Phase 4O — Ready With Gaps  
**Final Audit Verdict:** **`READY WITH GAPS`**

---

## Executive Summary

Phase 4P-A was executed as a read-only-first deployment audit to determine what is required to safely deploy and reliably operate the SSRL Internal Business Management System in production. 

The application codebase is feature-complete across operational trips, Party and Vehicle Owner masters, Market Vehicles, Own Fleet, Payment Module (single source of truth for money movement), Billing Lifecycle (individual and consolidated billing, versioning, cancellation, PDF generation), Financial Reports, CA read-only workspace, and Document Management. All 17 backend test suites (252 tests) and all 31 frontend test suites (115 tests) pass with zero errors. Backend TypeScript typecheck, frontend Oxlint, and frontend production build pass cleanly.

However, the repository currently lacks standard production build and runtime scripts for the backend, has development-only quick-login UI elements exposed unconditionally on the login screen, lacks environment-variable configurability for persistent storage paths and CORS origins, lacks an automated migration runner and tracking table, and does not provide an automated Owner provisioning CLI script.

These gaps are non-architectural and can be resolved through deployment preparation without modifying core business rules, financial logic, or database constraints.

---

## 1. Current Architecture Discovered From the Repository

```
+-----------------------------------------------------------------------------------+
|                                CLIENT BROWSER                                     |
|  React 19 SPA (Vite 8, React Router v7, TanStack Query v5, Zustand, Tailwind v4)  |
+----------------------------------------+------------------------------------------+
                                         | HTTP/REST + Bearer JWT
                                         v
+-----------------------------------------------------------------------------------+
|                              BACKEND APPLICATION                                 |
|  Express 5, TypeScript 5.9, CommonJS, Helmet, Pino Logging, Express Rate Limit   |
|                                                                                   |
|  Modules:                                                                         |
|  - Auth (/api/auth)                   - Health Check (/api/health)                |
|  - Trips (/api/trips)                 - Documents (/api/documents)                |
|  - Parties (/api/parties)             - Vehicle Owners (/api/vehicle-owners)      |
|  - Market Vehicles (/api/market-veh)  - Own Fleet (/api/own-fleet)                |
|  - Payments (/api/payments)           - Bills (/api/bills)                        |
|  - Reports (/api/reports)             - Dashboard (/api/dashboard)                |
|  - Bill Templates & Numbering Series  - Dynamic Fields (/api/dynamic-fields)      |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    v                                   v
+--------------------------------------+   +----------------------------------------+
|          PERSISTENT STORAGE          |   |          POSTGRESQL DATABASE           |
| LocalStorageService abstraction      |   | PostgreSQL 13+ (tested on PostgreSQL 18|
| Files stored by UUID on local disk   |   | 35+ relational tables, triggers,       |
| Keyed in DB documents table          |   | foreign keys, pgcrypto, immutability   |
+--------------------------------------+   +----------------------------------------+
```

### 1.1 Backend Runtime
- **Runtime & Framework:** Node.js (v20+ recommended), Express v5.2.1, CommonJS module format, TypeScript v5.9.3.
- **Entry Point:** `backend/src/server.ts` imports Express app from `backend/src/app.ts`, verifies database connectivity via `SELECT 1`, and listens on `config.port` (default: 3000).
- **Graceful Shutdown:** `backend/src/server.ts` registers handlers for `SIGTERM` and `SIGINT`. It gracefully closes the HTTP server, shuts down the PostgreSQL connection pool via `pool.end()`, and forces termination after a 10-second timeout if cleanup hangs.
- **Security Middleware:** 
  - `helmet()` enabled for secure HTTP headers.
  - `cors()` enabled in `backend/src/app.ts` (currently defaults to wildcard `*`).
  - `express-rate-limit` configured at `/api` level (1,000 requests per 15-minute window per IP, in-memory).
  - JSON payload limit set to 5MB (`express.json({ limit: '5mb' })`).
- **Logging & Redaction:** Pino v10.4.0 (`backend/src/utils/logger.ts`) with `pinoHttp` request logging. Explicit redaction is configured for `req.headers.authorization`, `password`, and `token`.
- **Health Check Endpoint:** `GET /api/health` queries `SELECT 1 as connected` on PostgreSQL pool. Returns HTTP 200 with `{ status: 'UP', database: 'UP' }` when healthy, or HTTP 503 with `{ status: 'UP', database: 'DOWN' }` if the database is disconnected.

### 1.2 Frontend Architecture
- **Framework & Tooling:** React v19.2.8, Vite v8.3.2, TypeScript v6.0.2, Tailwind CSS v4.3.3 (`@tailwindcss/vite`).
- **Routing:** React Router v7.18.4 (`frontend/src/App.tsx`), full SPA routing structure covering all operational, master, billing, financial, report, and document views.
- **State Management & Data Fetching:** 
  - `@tanstack/react-query` v5.104.1 for server cache, data synchronization, and query management.
  - `zustand` v5.0.15 for authentication state (`useAuthStore`).
- **API Client:** Axios v1.20.0 (`frontend/src/services/api.ts`).
  - Base URL resolved from `import.meta.env.VITE_API_URL || 'http://localhost:3000'`.
  - Request interceptor automatically attaches `Authorization: Bearer <token>`.
  - Response interceptor catches HTTP 401 Unauthorized, clears local token, and dispatches a window `unauthorized` event to redirect to `/login`.
- **Production Build Output:** Emits static assets to `frontend/dist/` (`dist/index.html`, minified JS and CSS bundles). Built cleanly in 2.18s.

### 1.3 Persistent Document Storage
- **Storage Abstraction:** `StorageService` interface in `backend/src/services/storage.service.ts` (`upload`, `getStream`, `delete`, `exists`).
- **Implementation:** `LocalStorageService` writes and streams files from local disk. Files are named by UUID (e.g., `trips/<trip_id>/pod_<uuid>.pdf`).
- **Metadata Reference:** Managed through `documents` and `document_links` tables. No raw internal filesystem paths or direct URLs are exposed to the browser. File downloads and previews are proxied via `GET /api/documents/:id/file` with RBAC entity-level authorization checks.
- **Current Limitation:** Default storage directory is hardcoded to `path.join(__dirname, '../../../storage/development')` rather than reading an environment variable such as `STORAGE_DIR`.

### 1.4 Database Layer
- **Engine:** PostgreSQL 13+ (tested and verified on PostgreSQL 18.0.6 via Scoop on Windows).
- **Extensions:** Requires `pgcrypto` extension for `gen_random_uuid()` default primary keys.
- **Connection Pool:** `pg.Pool` (`backend/src/db/index.ts`) configured with `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`.
- **Data Integrity:** 35+ tables, foreign key constraints (`ON DELETE RESTRICT`), custom check constraints (e.g. mobile number regex, valid status enums), database triggers for `updated_at` timestamps, and unique partial indexes for active bill items and active payment allocations.

---

## 2. Required Environment Variables

All environment variables read across the backend and frontend are audited below. **No secret values are printed.**

### 2.1 Backend Environment Variables

| Variable Name | Required / Optional | Default Value | Description / Validation Rule |
| :--- | :---: | :---: | :--- |
| `NODE_ENV` | Optional | `development` | Environment mode (`development` \| `production` \| `test`). Must be `production` in production. |
| `PORT` | Optional | `3000` | Port on which Express HTTP server listens. |
| `DATABASE_URL` | **Required** | *None* | Full PostgreSQL connection URI: `postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=<mode>`. Validated by Zod at startup. Fails immediately if missing. |
| `JWT_SECRET` | **Required** | *None* | Cryptographic secret for signing and verifying JWT authentication tokens. Validated by Zod at startup: **minimum 32 characters required**. Fails immediately if shorter or missing. |
| `LOG_LEVEL` | Optional | `info` | Minimum log level for Pino: `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace`. Set to `info` or `warn` in production. |
| `STORAGE_DIR` *(Recommended)* | Optional (Gap) | `../../storage/development` | Path to persistent storage root for uploaded documents and generated PDFs. Must be added to allow volume mounts. |
| `CORS_ORIGIN` *(Recommended)* | Optional (Gap) | `*` (Wildcard) | Allowed frontend origin URL (e.g., `https://app.ssrl.in`) to restrict cross-origin browser requests in production. |

### 2.2 Frontend Environment Variables

| Variable Name | Required / Optional | Default Value | Description / Validation Rule |
| :--- | :---: | :---: | :--- |
| `VITE_API_URL` | Optional | `http://localhost:3000` | Base URL for backend API requests. Baked into the frontend static bundle during `npm run build`. In production where frontend is reverse-proxied behind Nginx/Caddy on the same origin, this should be set to empty string or relative path `/api` to avoid cross-origin overhead. |

### 2.3 Safe Startup Failure Verification
In `backend/src/config/index.ts`, environment variables are parsed synchronously through Zod:
```typescript
const _env = envSchema.safeParse(process.env);
if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}
```
- If `DATABASE_URL` is missing: The application logs validation errors and terminates with exit code 1.
- If `JWT_SECRET` is missing or fewer than 32 characters: The application logs validation errors and terminates with exit code 1.
- Development fallback secrets are **not** silently injected if production values are missing.

---

## 3. Deployment Blockers & Gap Ranking

The audit identifies the following gaps, ranked by severity:

| Rank | Severity | Issue Summary | Location | Impact | Remediation Plan |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **B-1** | **HIGH** | **Missing Backend Build and Start Scripts** | `backend/package.json` | `package.json` contains only `"test": "jest"`. There is no `"build"` script to compile TypeScript to JavaScript, and no `"start"` script to execute the compiled output. `main` incorrectly points to `index.js`. | Add `"build": "tsc -p tsconfig.build.json"` and `"start": "node dist/server.js"` to `backend/package.json`. |
| **B-2** | **HIGH** | **TypeScript Compiler Output Directory Nesting** | `backend/tsconfig.json` | `tsconfig.json` specifies `"include": ["src/**/*", "tests/**/*"]`. Compiling with `tsc` produces `dist/src/server.js` and `dist/tests/...` instead of `dist/server.js`. Running `node dist/server.js` fails with module not found. | Create `backend/tsconfig.build.json` extending base tsconfig with `"include": ["src/**/*"]` and `"exclude": ["tests/**/*", "node_modules", "dist"]`. |
| **B-3** | **HIGH** | **Persistent Storage Path Not Configurable** | `backend/src/services/storage.service.ts` | Path is hardcoded via `path.join(__dirname, '../../../storage/development')`. In production containers or standalone VMs, mounted persistent volumes cannot be targeted via environment variables. | Add `STORAGE_DIR` to `config/index.ts` and initialize `LocalStorageService(config.storageDir)`. |
| **B-4** | **HIGH** | **Development Quick-Login Buttons Rendered in Production UI** | `frontend/src/pages/Login.tsx` | Lines 120–155 display "Or development quick login" buttons (`Owner`, `Staff`, `CA`). Clicking them sets `fake-jwt-token`. While backend rejects fake tokens with 401, exposing bypass buttons in production UI creates confusion and vulnerability appearance. | Wrap quick-login buttons in `{import.meta.env.DEV && (...) }` so Vite compiler completely removes them from production builds. |
| **B-5** | **HIGH** | **Ephemeral Container Storage Risk** | `storage.service.ts` & Deployment Target | If deployed to a stateless container platform (standard Cloud Run / Heroku dyno without persistent volume), uploaded documents, PODs, and bill PDFs will be wiped on container restart or scale-out. | Require a persistent volume mount (`/data/storage`) or an S3/GCS storage adapter for multi-instance deployments. |
| **B-6** | **MEDIUM** | **Open Wildcard CORS in Backend** | `backend/src/app.ts` | `app.use(cors())` permits requests from any web origin. | Read `CORS_ORIGIN` from environment and configure `cors({ origin: config.corsOrigin, credentials: true })`. |
| **B-7** | **MEDIUM** | **No Automated Migration Runner or Tracking Table** | `database/migrations/` | Migrations are raw SQL files (`001_initial_schema.sql`, `002_add_document_expiry.sql`). There is no `schema_migrations` tracking table. Automated deployments cannot detect which migrations have already been applied. | Implement a lightweight migration runner script or track applied migrations in a `schema_migrations` table during CI/CD. |
| **B-8** | **MEDIUM** | **No Repeatable CLI Script for Initial Owner Provisioning** | Backend / Database | No user management UI exists (accepted backlog). Users are only seeded inside test suites. Production has no CLI script to provision the first Owner safely without manual SQL. | Provide `backend/src/scripts/seed-owner.ts` (`npm run seed:owner`) taking credentials via environment variables. |
| **B-9** | **MEDIUM** | **SPA Client-Side Route Fallback Requirement** | Frontend Hosting | Frontend uses `react-router-dom` with HTML5 History API. Direct URL access (e.g. `/trips/new`, `/reports`) returns 404 on standard web servers without rewrite rules. | Document and provide standard Nginx / Caddy rewrite configuration: `try_files $uri $uri/ /index.html;`. |
| **B-10**| **MEDIUM** | **Database Connection Pool SSL Support** | `backend/src/db/index.ts` | `pg.Pool` does not explicitly configure SSL options for managed cloud databases (AWS RDS, GCP Cloud SQL, Supabase) that require TLS connections. | Enable SSL configuration in `db/index.ts` when `DATABASE_URL` contains `sslmode=require` or when `NODE_ENV === 'production'`. |
| **B-11**| **LOW** | **In-Memory Rate Limiting** | `backend/src/app.ts` | `express-rate-limit` maintains counters in process memory. If scaled horizontally across multiple instances, rate limits are not shared. | Sufficient for single-instance release; use Redis-backed store if scaling to multiple instances. |
| **B-12**| **LOW** | **Vite Bundle Size Warning** | `frontend/dist/assets/` | Main JS bundle is 806 kB (195 kB gzip), triggering Vite warning for chunks > 500 kB. | Optimize with React route-level lazy loading (`React.lazy()`) in future optimization phase. |

---

## 4. Database Migration, Backup, Restore, & Rollback Procedures

### 4.1 Supported PostgreSQL Version
- Minimum supported: **PostgreSQL 13** (requires `pgcrypto` extension for `gen_random_uuid()`).
- Tested and verified: **PostgreSQL 18.0.6**.

### 4.2 Migration Execution Order
Migrations must be executed in strictly sequential order on a clean database:

```bash
# Step 1: Core Schema (tables, triggers, constraints, indexes)
psql -U $DB_USER -d $DB_NAME -f database/migrations/001_initial_schema.sql

# Step 2: Document Expiry Column Addition
psql -U $DB_USER -d $DB_NAME -f database/migrations/002_add_document_expiry.sql

# Step 3: Canonical Dynamic Field Definitions Seed (88 fields for Bill Designer)
psql -U $DB_USER -d $DB_NAME -f database/seed/dynamic_fields.seed.sql
```

### 4.3 Transactionality & Partial Failure Handling
- **`001_initial_schema.sql`** begins with `BEGIN;` and ends with `COMMIT;`. If any syntax error, constraint failure, or permission error occurs during execution, PostgreSQL rolls back the entire migration atomically.
- **`002_add_document_expiry.sql`** contains a single `ALTER TABLE documents ADD COLUMN expiry_date DATE NULL;`.
- **`dynamic_fields.seed.sql`** contains standard `INSERT INTO dynamic_field_definitions` statements.
- **Repeatability:** Migrations do NOT use `IF NOT EXISTS` on all `CREATE TABLE` statements. Running `001_initial_schema.sql` twice will fail on table existence. A migration tracking table (`schema_migrations`) is strongly recommended before production automation.

### 4.4 Mandatory Pre-Migration Backup Procedure
Before applying any migration or schema change in production, an immutable binary dump must be created:

```bash
# Full compressed binary backup with verbose logging
pg_dump -Fc -v -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f /backups/ssrl_pre_migration_$(date +%Y%m%d_%H%M%S).dump
```

### 4.5 Recovery & Rollback Procedure
Because the migrations are forward-only and do not include down-migration scripts (`DROP TABLE`, etc.), rolling back a failed migration or reverting to a previous schema state is achieved via point-in-time database restoration:

```bash
# 1. Terminate active application connections
psql -U $DB_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"

# 2. Drop and recreate the target database
psql -U $DB_USER -d postgres -c "DROP DATABASE $DB_NAME;"
psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# 3. Restore from pre-migration backup dump
pg_restore -v -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME /backups/ssrl_pre_migration_<timestamp>.dump
```

### 4.6 Required Extensions, Triggers, & Permissions
- **Extensions:** `pgcrypto` (created in migration 001 via `CREATE EXTENSION IF NOT EXISTS pgcrypto;`).
- **Triggers:**
  - `trigger_update_updated_at` on tables with `updated_at` columns.
  - Audit logging triggers on security-critical tables.
- **Database User Permissions:**
  - Deployment user requires DDL privileges (`CREATE TABLE`, `CREATE INDEX`, `CREATE TRIGGER`, `ALTER TABLE`).
  - Application runtime user requires DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on all tables and sequences.

---

## 5. Persistent Document Storage Assessment

### 5.1 Storage Architecture
The SSRL application stores business-critical binary documents:
1. Proof of Delivery (POD) documents (JPG/PNG/PDF).
2. Freight and trip invoices.
3. Own Fleet compliance documents (Fitness certificates, National Permits, Road Tax receipts, Insurance policies, PUC certificates).
4. Bill template logos, signatures, and stamps.
5. Generated bill PDF documents.

### 5.2 Persistence & Container Survival
- The application currently implements `LocalStorageService` (`backend/src/services/storage.service.ts`).
- **Process Restarts:** Files written to local disk survive process restarts on a persistent filesystem.
- **Redeployments & Container Recreation:** In standard containerized environments (Docker containers, Kubernetes pods, AWS ECS, GCP Cloud Run), the container root filesystem is ephemeral. Recreating or restarting a container will destroy all stored documents unless a persistent volume is mounted.
- **Multi-Instance Deployments:** If multiple backend replicas run behind a load balancer, local filesystem storage will lead to data divergence (an upload saved on Container A cannot be read when Container B serves the preview request).

### 5.3 Storage Path Resolution Fix
In `backend/src/services/storage.service.ts`:
```typescript
// Current hardcoded path:
constructor(baseDir: string = path.join(__dirname, '../../../storage/development'))

// Recommended production path:
constructor(baseDir: string = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'))
```

### 5.4 Storage Reconciliation & Failure Recovery
- **Metadata Reference:** Every stored file corresponds to a row in `documents` with `storage_provider = 'LOCAL'` and `storage_key = '<relative_path>'`.
- **Missing File Handling:** If a physical file is deleted or inaccessible, `GET /api/documents/:id/file` returns HTTP 404 with `{ code: 'NOT_FOUND', message: 'File not found' }`. The frontend gracefully displays an alert without crashing (verified by test).
- **Soft Deletion Preservation:** Document deletion in SSRL is soft-delete (`documents.is_deleted = true`). The physical file is retained in storage to preserve historical auditability and prevent breaking bill-version snapshots.
- **Orphan File Handling:** If an upload stream succeeds but database transaction fails, an orphan file may remain on disk. A periodic reconciliation script (`scripts/reconcile-storage.ts`) can scan `storage_key` entries against disk files to clean unreferenced files.

---

## 6. Secure Initial Owner Provisioning Procedure

### 6.1 Requirements
In accordance with `AGENTS.md` and `ROLES_AND_PERMISSIONS.md`:
- Passwords must be hashed using bcrypt (10 rounds).
- The initial Owner user must have `role = 'OWNER'`, `is_active = true`, and a valid mobile number (`^\+?[0-9]{10,15}$`).
- Initial provisioning must not use hardcoded credentials, committed secrets, or an unauthenticated public registration endpoint.

### 6.2 CLI Script Specification (`backend/src/scripts/seed-owner.ts`)
To be executed once during initial deployment:

```typescript
import { pool } from '../db';
import { hashPassword } from '../modules/auth/auth.service';
import { logger } from '../utils/logger';

async function seedOwner() {
  const name = process.env.INITIAL_OWNER_NAME || 'SSRL Admin';
  const mobile = process.env.INITIAL_OWNER_MOBILE;
  const password = process.env.INITIAL_OWNER_PASSWORD;

  if (!mobile || !password) {
    console.error('❌ Error: INITIAL_OWNER_MOBILE and INITIAL_OWNER_PASSWORD must be provided.');
    process.exit(1);
  }

  if (!/^\+?[0-9]{10,15}$/.test(mobile)) {
    console.error('❌ Error: Mobile number must be 10-15 digits.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await pool.query("SELECT id FROM users WHERE role = 'OWNER' AND is_active = true LIMIT 1");
  if (existing.rows.length > 0) {
    console.log('ℹ️ Active Owner user already exists. Skipping initial provisioning.');
    process.exit(0);
  }

  const hashedPassword = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (name, mobile_number, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'OWNER', true)
     ON CONFLICT (mobile_number) DO NOTHING`,
    [name, mobile, hashedPassword]
  );

  console.log(`✅ Owner user provisioned successfully for mobile: ${mobile}`);
  process.exit(0);
}

seedOwner().catch((err) => {
  console.error('❌ Failed to provision Owner:', err);
  process.exit(1);
});
```

### 6.3 Execution Command
```bash
INITIAL_OWNER_NAME="SSRL Owner" \
INITIAL_OWNER_MOBILE="9876543210" \
INITIAL_OWNER_PASSWORD="<STRONG_RANDOMLY_GENERATED_PASSWORD>" \
npm run seed:owner
```

---

## 7. Hosting-Independent Deployment Checklist

```
+-----------------------------------------------------------------------------------+
|                           DEPLOYMENT READINESS WORKFLOW                           |
|                                                                                   |
|  [1] Environment Config   -->  [2] Database Migrations  -->  [3] Initial Owner    |
|      Set .env variables        Run 001, 002, & seed          Run seed-owner script|
|                                                                                   |
|  [4] Backend Service      -->  [5] Frontend Build       -->  [6] Smoke Tests      |
|      Mount persistent vol      Build SPA with VITE_URL       Execute 7 Journeys   |
+-----------------------------------------------------------------------------------+
```

### Phase 1: Environment & Secrets Configuration
- [ ] Generate secure 64-character random string for `JWT_SECRET` (`openssl rand -base64 48`).
- [ ] Provision managed PostgreSQL instance (v13+) and obtain connection string.
- [ ] Create persistent directory for document storage (e.g., `/var/lib/ssrl/storage` or Docker volume `ssrl_storage`).
- [ ] Set `NODE_ENV=production`.
- [ ] Set `STORAGE_DIR=/var/lib/ssrl/storage`.
- [ ] Set `CORS_ORIGIN=https://app.ssrl.in`.

### Phase 2: Database Provisioning & Migration
- [ ] Verify PostgreSQL connection: `psql $DATABASE_URL -c "SELECT 1;"`.
- [ ] Apply `database/migrations/001_initial_schema.sql`.
- [ ] Apply `database/migrations/002_add_document_expiry.sql`.
- [ ] Apply `database/seed/dynamic_fields.seed.sql`.
- [ ] Verify table count (35+ tables created) and verify `pgcrypto` extension is installed.

### Phase 3: Initial User Bootstrapping
- [ ] Run `npm run seed:owner` with environment variables `INITIAL_OWNER_MOBILE` and `INITIAL_OWNER_PASSWORD`.
- [ ] Verify record exists in `users` table with `role = 'OWNER'` and `is_active = true`.

### Phase 4: Backend Service Deployment
- [ ] Install production dependencies: `npm ci --omit=dev`.
- [ ] Compile TypeScript backend: `npm run build`.
- [ ] Mount persistent storage volume to `$STORAGE_DIR`.
- [ ] Start backend process: `node dist/server.js` (managed by Systemd, Docker, or PM2).
- [ ] Verify health endpoint: `curl -f http://127.0.0.1:3000/api/health` returns `200 OK` with `{ "database": "UP" }`.

### Phase 5: Frontend Build & Web Server Configuration
- [ ] Build frontend bundle: `npm ci && npm run build` (with `VITE_API_URL` pointing to backend).
- [ ] Copy `frontend/dist/` to web server document root (e.g., `/var/www/ssrl/dist`).
- [ ] Configure Nginx / Caddy with HTTPS, SSL certificates, and SPA rewrite:
  ```nginx
  server {
      listen 443 ssl http2;
      server_name app.ssrl.in;

      ssl_certificate /etc/letsencrypt/live/app.ssrl.in/fullchain.pem;
      ssl_certificate_key /etc/letsencrypt/live/app.ssrl.in/privkey.pem;

      root /var/www/ssrl/dist;
      index index.html;

      # Frontend SPA routing fallback
      location / {
          try_files $uri $uri/ /index.html;
      }

      # Backend API reverse proxy
      location /api/ {
          proxy_pass http://127.0.0.1:3000;
          proxy_http_version 1.1;
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

---

## 8. Proposed Post-Deployment Smoke Tests & Acceptance Criteria

Smoke tests must be conducted using synthetic test records (no real customer data) immediately following deployment:

| # | User Journey / Workflow | Steps to Execute | Expected Outcome / Acceptance Criteria |
| :-: | :--- | :--- | :--- |
| **S-1** | **Authentication & Role Authorization** | 1. Log in with provisioned Owner credentials.<br>2. Verify JWT token stored in browser.<br>3. Check user profile via `/api/auth/me`.<br>4. Test invalid password (must return 401). | Successful authentication; navigation to `/dashboard`; navigation menu displays all Owner links; quick-login buttons are not visible. |
| **S-2** | **Trip Management & POD Upload** | 1. Create Party and Market Vehicle.<br>2. Create a Market Trip (`/trips/new`).<br>3. Transition status from `CREATED` -> `LOADING` -> `IN_TRANSIT` -> `COMPLETED`.<br>4. Upload POD document (PDF/PNG).<br>5. Download/preview uploaded POD. | Trip details display correctly; POD file downloads with valid binary stream; `documents` record created; audit entry logged. |
| **S-3** | **Payment Creation & Allocation** | 1. Record Incoming Payment from Party (`/payments/new`).<br>2. Allocate payment to the completed trip.<br>3. Verify Trip financial status updates.<br>4. Verify Party outstanding balance reduces.<br>5. Overpay by ₹5,000 and verify excess converts to Party Credit. | Payment recorded in Payment Module; allocations match total payment; Party Credit ledger records ₹5,000 available credit. |
| **S-4** | **Payment Reversal Workflow** | 1. As Owner, navigate to `/payments/:id`.<br>2. Click "Reverse Payment", enter reversal reason.<br>3. Verify payment status becomes `REVERSED`.<br>4. Check Trip and Party balances. | Payment marked reversed; allocations set to `REVERSED`; Trip balance returns to outstanding; Party credit revoked; audit entry recorded. |
| **S-5** | **Billing Lifecycle & PDF Generation** | 1. Navigate to `/bills/new`.<br>2. Select Party and unbilled eligible trip.<br>3. Generate Bill (Individual mode).<br>4. Preview generated bill PDF.<br>5. Mark bill as `SUBMITTED`.<br>6. Allocate payment to cover full bill amount. | Bill generated with sequence number (e.g. `SRL/26-27/001`); PDF renders structured template; bill status transitions to `PAID` automatically upon full payment. |
| **S-6** | **Own Fleet & Expiry Tracking** | 1. Create Own Fleet vehicle (`/own-fleet/new`).<br>2. Upload Fitness certificate with expiry date set to tomorrow.<br>3. Navigate to `/documents`.<br>4. Verify "Expiring Soon" count increases.<br>5. Filter by "Expiring Soon". | Vehicle created with status `AVAILABLE`; document list displays expiry date; banner highlights expiring document; filter isolates record. |
| **S-7** | **CA Read-Only Workspace & Export** | 1. Log in as CA user.<br>2. Navigate to `/reports`.<br>3. Review Financial Overview, P&L, Payment Modes, TDS, Bill Reconciliation.<br>4. Trigger CSV export on Incoming Payments.<br>5. Attempt `POST /api/payments` or `POST /api/bills` via API client. | Reports display authoritative backend data; CSV export reconciles with table totals; mutation requests return HTTP 403 Forbidden. |

---

## 9. Exact Commands Inspected / Executed and Actual Outcomes

| Command Line | Working Directory | Exit Code | Actual Output / Outcome |
| :--- | :--- | :---: | :--- |
| `npm test -- --runInBand` | `backend/` | **0** | **17 test suites passed, 252 tests passed (100%)**. Total runtime: 29.46s. |
| `npx tsc --noEmit` | `backend/` | **0** | Zero TypeScript compilation errors. All backend typings sound. |
| `npm test` | `frontend/` | **0** | **31 test files passed, 115 tests passed (100%)**. Total runtime: 105.96s. |
| `npm run lint` | `frontend/` | **0** | Oxlint inspected 93 files: **0 errors, 23 warnings** (React hook dependency suggestions). |
| `npm run build` | `frontend/` | **0** | `tsc -b && vite build` built cleanly in 2.18s. Emitted `dist/index.html` (0.45 kB), CSS (50.8 kB), JS (806.6 kB). |
| `npx tsc` | `backend/` | **0** | Successfully compiled, but exposed directory nesting defect (`dist/src/server.js` and `dist/tests/` created). |
| `psql -U postgres -d srl_db -c "SELECT 1 as connected;"` | Root | **0** | Returned `connected = 1`. Confirmed local PostgreSQL connectivity. |
| `git status` | Root | **0** | Working tree clean on branch `main` (untracked test storage files only). |

---

## 10. Explicitly Unverified Assumptions & Remaining Risks

1. **Multi-Instance Container Concurrency with Local Storage:**
   - *Assumption:* The initial deployment will run as a single instance (or single container) with a mounted persistent volume.
   - *Risk:* If deployed to an auto-scaling multi-instance environment without shared network storage (EFS/NFS) or S3/GCS object storage, uploaded files will not be accessible across instances.
2. **Database SSL Requirements on Managed Cloud Providers:**
   - *Assumption:* The target PostgreSQL instance accepts connections using standard credentials.
   - *Risk:* Cloud providers such as AWS RDS, GCP Cloud SQL, and Azure Database for PostgreSQL enforce SSL/TLS with specific certificate validation. The backend connection pool (`backend/src/db/index.ts`) must support SSL configuration flags.
3. **Large PDF Memory Footprint Under Load:**
   - *Assumption:* PDF bill generation volume will follow typical transport company daily operational loads (10–50 bills/day).
   - *Risk:* Dynamic PDF rendering with complex multi-page tables requires Node.js memory. Generating dozens of massive consolidated bills concurrently could lead to transient memory spikes.
4. **Accepted Post-Release Backlog Placeholders:**
   - `/settings/system` and `/settings/users` are documented placeholders. User provisioning and role adjustments in production currently require direct database execution or the proposed CLI script.
   - The visual notification bell has no real-time WebSocket backend engine.

---

## Final Audit Verdict

# **`READY WITH GAPS`**

### Summary of Verdict
The core SSRL application is robust, strictly adheres to all locked business rules and financial source-of-truth requirements, and has comprehensive automated test coverage across both backend and frontend. 

It is ready for production deployment preparation once the **4 High-Priority configuration fixes** are applied:
1. Adding `"build"` and `"start"` scripts to `backend/package.json`.
2. Configuring `backend/tsconfig.build.json` to compile only `src/` to `dist/server.js`.
3. Making `STORAGE_DIR` and `CORS_ORIGIN` configurable via environment variables.
4. Hiding development quick-login buttons in production frontend builds via `import.meta.env.DEV`.
