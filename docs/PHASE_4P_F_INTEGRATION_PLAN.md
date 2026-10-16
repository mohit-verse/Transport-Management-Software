# Phase 4P-F — Render + Vercel + Supabase Integration Plan

**Project:** Shri Sanwariya Road Lines (SSRL)  
**Repository:** `D:\Shri Sanwariya RO\SSRL`  
**Phase:** 4P-F (Integration Preparation)  
**Mode:** Integration Specification & Staging Workflow  
**Production Deployment Gate:** STRICTLY LOCKED  

---

## 1. Separation of Responsibilities

To ensure security, operational control, and financial safety, all actions are strictly partitioned between the **User** (Account Holder / Organization Admin) and the **Agent** (Technical Implementer).

```mermaid
flowchart TD
    subgraph UserResponsibilities ["User Actions (Administrative & Financial Gatekeeper)"]
        U1["Create / Select Provider Accounts<br/>(Supabase, Render, Vercel, Cloudflare)"]
        U2["Authorize Billing & Select Free/Paid Tiers"]
        U3["Generate Database Passwords & Auth Secrets"]
        U4["Enter Secrets Directly into Provider Dashboards"]
        U5["Authorize Staging & Production Deployment Gates"]
    end

    subgraph AgentResponsibilities ["Agent Actions (Technical Integration & Verification)"]
        A1["Prepare Build & Start Commands"]
        A2["Author Configuration Manifests (vercel.json, render.yaml)"]
        A3["Map Environment Variables (Placeholders Only)"]
        A4["Execute Database Migrations & Dynamic Field Verification"]
        A5["Run Automated Health Checks, RBAC & Workflow Tests"]
        A6["Audit Deployment Integrity & Formulate Rollback Plans"]
    end

    U1 --> A1
    U3 --> U4
    U4 --> A4
    A4 --> A5
    A5 --> U5
```

### 1.1 User Actions (Dashboard & Secret Operations)
1. **Account Creation:** Create or log into accounts on [Supabase](https://supabase.com), [Render](https://render.com), [Vercel](https://vercel.com), and [Cloudflare](https://cloudflare.com).
2. **Project Creation:** Create an isolated project named `ssrl-staging` on each provider.
3. **Database Credential Generation:** Generate a strong, high-entropy database password in Supabase and record it securely in the organization password manager.
4. **Secret Configuration:** Copy environment variable values directly into Render and Vercel dashboard environment consoles. **Never send real secrets in chat or prompt context.**
5. **Billing Controls:** Verify billing limits, set budget alerts ($0 or $10/month cap), and approve payment authorization if upgrading to paid tiers.
6. **Deployment Authorization:** Review pre-flight validation checklists before triggering live deployment builds.

### 1.2 Agent Actions (Repository & Verification Operations)
1. **Build & Runtime Configuration:** Prepare verified build scripts (`npm run build`), start commands (`npm run start`), and Node.js version specifications.
2. **SPA Routing Configuration:** Configure `vercel.json` rewrite rules to ensure client-side routes (`/trips/:id`, `/bills/:id`, `/payments`) resolve cleanly to `/index.html`.
3. **Environment Template Definition:** Define complete `.env.example` templates with explicit validation rules and placeholder documentation.
4. **Database Migration Execution:** Execute `npm run migrate` against the staging Supabase database to instantiate all 47 canonical tables, 11 stored procedures, 29 triggers, and 86 dynamic fields.
5. **Initial Owner Provisioning:** Execute `npm run seed:owner` to securely provision the initial Owner account with mobile number and hashed password.
6. **Verification & Audit:** Verify HTTPS, CORS headers, RBAC authorization, payment immutability, PDF rendering, file streaming, and backup restoration.

---

## 2. Environment Variable Configuration Matrix

All configuration parameters are validated via Zod in `backend/src/config/index.ts`. Below are the exact mappings and placeholder strings.

### 2.1 Backend Environment Variables (Render Web Service)

| Variable Name | Required | Example / Placeholder String | Description & Security Constraint |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security mode, enforces persistent storage, and disables CORS wildcards. |
| `PORT` | Yes | `3000` | Port on which Express listens. Render routes external HTTPS traffic to this port. |
| `DATABASE_URL` | Yes | `postgresql://postgres.[REF]:[DB_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres` | **Mandatory Supavisor Session Pooler URL (Port 5432).** Resolves IPv4 constraint and supports triggers. |
| `DATABASE_SSL` | Yes | `true` | Enforces SSL connection with `rejectUnauthorized: true`. |
| `DATABASE_SSL_CA` | Optional | `[SUPABASE_ROOT_CERT_BASE64_OR_PEM]` | Optional project CA cert; if omitted, Node uses public root CAs. |
| `JWT_SECRET` | Yes | `[GENERATE_RANDOM_64_CHAR_HEX_KEY]` | Cryptographic secret for signing auth tokens (minimum 32 characters). |
| `CORS_ORIGIN` | Yes | `https://ssrl-staging.vercel.app` | Exact frontend origin URL. Comma-separated if multiple; wildcards prohibited. |
| `LOG_LEVEL` | No | `info` | Logging verbosity (`info`, `warn`, `error`). |
| `STORAGE_DIR` | Conditional | `/var/data/ssrl/storage` | Required if using Render Persistent Disk. Path must be absolute. |
| `STORAGE_DRIVER` | Conditional | `s3` (or `local`) | Driver selection for private object storage vs local POSIX. |
| `S3_ENDPOINT` | Conditional | `https://[ACCOUNT_ID].r2.cloudflarestorage.com` | Cloudflare R2 / S3-compatible private storage endpoint. |
| `S3_REGION` | Conditional | `auto` | Storage bucket region. |
| `S3_BUCKET` | Conditional | `ssrl-staging-documents` | Private document storage bucket name. |
| `S3_ACCESS_KEY_ID` | Conditional | `[R2_OR_S3_ACCESS_KEY]` | Storage API access key id. |
| `S3_SECRET_ACCESS_KEY` | Conditional | `[R2_OR_S3_SECRET_KEY]` | Storage API secret access key. |
| `BACKUP_DIR` | No | `/var/data/ssrl/backups` | Local staging path for dump artifacts prior to offsite upload. |
| `BACKUP_RETENTION_COUNT` | No | `7` | Number of recent verified backups retained locally. |
| `BACKUP_RETENTION_DAYS` | No | `30` | Minimum retention window in days for historical backup manifests. |
| `INITIAL_OWNER_MOBILE` | Yes | `9876543210` | 10-digit mobile number for initial Owner account. |
| `INITIAL_OWNER_PASSWORD` | Yes | `[TEMPORARY_INITIAL_OWNER_PASSWORD]` | Temporary initial password; must be changed immediately on login. |
| `INITIAL_OWNER_NAME` | Yes | `Rohit Yadav` | Full legal name of initial Owner. |

### 2.2 Frontend Environment Variables (Vercel Project)

| Variable Name | Required | Example / Placeholder String | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Yes | `https://ssrl-backend-staging.onrender.com` | Base URL of the deployed Render backend API. Handled cleanly by `resolveBaseUrl()`. |

---

## 3. Provider Build & Runtime Manifests

### 3.1 Frontend: Vercel Configuration (`frontend/vercel.json`)
The React application utilizes client-side routing via `react-router-dom`. To prevent HTTP 404 errors when users refresh or directly access deep links (e.g. `/trips/c0a80101-...` or `/parties/new`), a rewrite rule routes all non-file requests to `/index.html`.

```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

- **Root Directory:** `frontend`
- **Build Command:** `npm run build` (`tsc -b && vite build`)
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 3.2 Backend: Render Service Configuration (`render.yaml`)
To ensure repeatable deployment without manual dashboard drift, a declarative blueprint can be utilized:

```yaml
services:
  - type: web
    name: ssrl-backend-staging
    env: node
    region: singapore # Choose closest to India (e.g. Singapore or Frankfurt)
    plan: free # or starter ($7/mo)
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: npm run start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        sync: false # Set securely in Render dashboard
      - key: DATABASE_SSL
        value: "true"
      - key: JWT_SECRET
        sync: false # Set securely in Render dashboard
      - key: CORS_ORIGIN
        sync: false # Set to Vercel staging URL
      - key: LOG_LEVEL
        value: info
```

---

## 4. Staging Deployment Sequence (7 Strictly Ordered Stages)

The staging deployment must follow this precise sequential workflow to prevent chicken-and-egg configuration errors and ensure complete auditability.

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Admin)
    participant Supa as Supabase Staging
    participant Rend as Render Staging
    participant Verc as Vercel Staging
    participant Agent as Agent / CLI Runner

    Note over User,Supa: Stage 1: Supabase Provisioning
    User->>Supa: Create "ssrl-staging" Project in Singapore/Mumbai
    User->>Supa: Extract Supavisor IPv4 Session URL (Port 5432)

    Note over User,Agent: Stage 2: Database Migration & Seeding
    Agent->>Supa: Execute pre-flight connection check
    Agent->>Supa: Execute npm run migrate (47 tables, 11 procs, 29 triggers)
    Agent->>Supa: Verify 86 dynamic field definitions active
    Agent->>Supa: Execute npm run seed:owner (Initial Owner account)

    Note over User,Rend: Stage 3: Render Backend Deployment
    User->>Rend: Create Web Service from GitHub repo (rootDir: backend)
    User->>Rend: Configure Environment Variables in Render Dashboard
    Rend->>Rend: Build (npm run build) & Start (npm run start)
    Rend->>Supa: Test database pool connection
    Rend-->>User: Health check passes (/api/health -> HTTP 200 UP)

    Note over User,Verc: Stage 4: Vercel Frontend Deployment
    User->>Verc: Import GitHub repo (rootDir: frontend)
    User->>Verc: Set VITE_API_URL = Render Backend URL
    Verc->>Verc: Build (tsc -b && vite build) -> dist/
    Verc-->>User: Frontend live at https://ssrl-staging.vercel.app

    Note over User,Agent: Stage 5: CORS & RBAC Operational Validation
    User->>Rend: Update CORS_ORIGIN with live Vercel URL
    Agent->>Verc: Execute automated synthetic UI & API tests
    Agent->>Rend: Verify Owner / Staff / CA role boundaries

    Note over Agent,Supa: Stage 6: Disaster Recovery & Persistence Validation
    Agent->>Rend: Trigger test POD upload & Bill PDF generation
    Agent->>Supa: Execute npm run backup (verify pg_dump & manifest)
    Rend->>Rend: Trigger cold service restart (verify persistence)
    Agent->>Supa: Execute npm run restore on disposable clone

    Note over User,Agent: Stage 7: Sign-Off & Cost Review
    Agent->>User: Compile Staging Verification Report & Metrics
    User->>User: Formally review and lock Staging baseline
```

### Detailed Stage Steps

#### Stage 1: Supabase Staging Project Provisioning
1. User logs into Supabase console and clicks **New Project**.
2. Project Name: `ssrl-staging`.
3. Database Password: Generate 24+ character alphanumeric password with special characters.
4. Region: Choose `Southeast Asia (Singapore)` or `South Asia (Mumbai)` for minimal network latency.
5. In **Project Settings -> Database -> Connection Pooling**:
   - Connection Type: **Session**
   - Host: `aws-0-[region].pooler.supabase.com`
   - Port: **5432**
   - User: `postgres.[project-ref]`

#### Stage 2: Schema Migration & Owner Provisioning
1. In an isolated staging terminal environment with `DATABASE_URL` configured to the staging Supabase instance:
   ```bash
   cd backend
   npm run build
   npm run migrate
   ```
2. Verify console output confirms:
   - `Discovered 2 migration file(s)`
   - `001_initial_schema.sql` applied
   - `002_add_document_expiry.sql` applied
   - `Canonical dynamic fields verified (86 definitions active)`
3. Provision the initial Owner account:
   ```bash
   npm run seed:owner
   ```
4. Verify user record exists in `public.users` with `role = 'OWNER'` and valid bcrypt password hash.

#### Stage 3: Render Backend Staging Configuration
1. User logs into Render dashboard and clicks **New -> Web Service**.
2. Connect the SSRL GitHub repository.
3. Configure settings:
   - **Name:** `ssrl-backend-staging`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`
4. In **Environment Variables**, add all required keys from Section 2.1.
5. Deploy service and inspect build logs. Verify output:
   - `[server] Application successfully bound to port 3000`
   - `GET /api/health` returns `{"success": true, "data": {"status": "UP", "database": "UP"}}`.

#### Stage 4: Vercel Frontend Staging Configuration
1. User logs into Vercel dashboard and clicks **Add New -> Project**.
2. Import the SSRL repository.
3. Configure project settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. In **Environment Variables**, configure:
   - `VITE_API_URL = https://ssrl-backend-staging.onrender.com`
5. Click **Deploy**. Verify build completes without TypeScript or lint warnings.

#### Stage 5: End-to-End Operational Validation
1. Open the Vercel staging URL in a private browser window.
2. Log in using the initial Owner credentials.
3. Verify Dashboard loads KPIs (`netPnl`, Total Trips, Receivables, Payables).
4. Perform operational workflow tests using synthetic data:
   - Create a synthetic Party (`Test Corp Pvt Ltd`).
   - Create a synthetic Vehicle Owner and Market Vehicle.
   - Create a Market Trip and verify initial status `CREATED`.
   - Record an incoming Payment allocated to the Trip.
   - Generate a test Bill and download the generated PDF.
5. Log out and log in as Staff (verify Payment Reversal button is hidden/prohibited).
6. Log in as CA (verify all edit/create buttons are prohibited and financial reports are accessible).

#### Stage 6: Disaster Recovery & Persistence Validation
1. Upload a synthetic POD document through the Trip details view.
2. Verify document downloads cleanly via `GET /api/documents/:id/file`.
3. In Render, trigger a manual restart of the web service container.
4. Re-fetch the document after restart:
   - If using Render Persistent Disk or Cloudflare R2: document stream succeeds with matching SHA-256.
   - If using local ephemeral disk: document stream fails with 404 (validates necessity of persistent storage).
5. Run the SSRL backup CLI:
   ```bash
   npm run backup
   ```
6. Verify `manifest.json` shows status `VERIFIED`, valid database dump size, and document checksums.

#### Stage 7: Staging Sign-Off & Cost Review
1. Document actual response times, cold start delays, and memory utilization.
2. Review Supabase and Render billing dashboards to confirm $0 incurred charges.
3. Compile all test evidence into the Phase 4P-F report for Owner review.

---

## 5. Rollback Procedures & Emergency Runbook

If any stage fails during staging or subsequent production releases, follow these exact rollback protocols.

```mermaid
flowchart TD
    Issue["Deployment Issue Detected<br/>(API Failure, Schema Error, or Corrupted State)"]
    Classify{"Identify Failure Domain"}

    Issue --> Classify

    Classify -->|"Frontend UI Bug"| RB_Front["Frontend Rollback (Vercel)"]
    Classify -->|"Backend API / Crash"| RB_Back["Backend Rollback (Render)"]
    Classify -->|"Database / Data Corruption"| RB_DB["Database Restoration (SSRL Restore CLI)"]

    RB_Front --> RB_Front_Action["1. Open Vercel Deployments<br/>2. Select Last Known Good Deployment<br/>3. Click 'Instant Rollback'<br/>(Traffic redirects in < 5 seconds)"]
    RB_Back --> RB_Back_Action["1. Open Render Dashboard<br/>2. Select Deploy History<br/>3. Click 'Rollback to this deploy'<br/>(Previous image redeployed)"]
    RB_DB --> RB_DB_Action["1. Put Backend in Maintenance Mode<br/>2. Locate latest VERIFIED backup manifest<br/>3. Run: npm run restore -- --backupId [ID]<br/>4. Verify schema & 86 dynamic fields<br/>5. Resume API traffic"]
```

### 5.1 Frontend Rollback (Vercel)
- **Time to Rollback:** < 10 seconds.
- **Procedure:**
  1. Navigate to **Vercel Dashboard -> Project -> Deployments**.
  2. Locate the previous successful deployment.
  3. Click the three dots (`...`) and select **Instant Rollback**.
  4. Global edge traffic immediately shifts to the previous build artifact.

### 5.2 Backend Rollback (Render)
- **Time to Rollback:** 1 – 2 minutes.
- **Procedure:**
  1. Navigate to **Render Dashboard -> Service -> Events / Deploys**.
  2. Locate the last healthy deployment commit.
  3. Click **Rollback** to re-activate the previous immutable container image.

### 5.3 Database Recovery Rollback (SSRL Restore Engine)
- **Time to Rollback:** 2 – 5 minutes.
- **Procedure:**
  1. Set backend service to maintenance mode or suspend Render service to prevent incoming traffic.
  2. Inspect the latest verified backup in `/var/data/ssrl/backups/`:
     ```bash
     ls -la /var/data/ssrl/backups/
     ```
  3. Execute deterministic restore using the verified manifest ID:
     ```bash
     cd backend
     npm run restore -- --backupId backup_2026-10-15T18-00-00-000Z
     ```
  4. Verify terminal output confirms:
     - `Database restore completed successfully via pg_restore`
     - `Canonical dynamic fields verified (86 definitions active)`
  5. Restart backend web service and verify `/api/health` reports `status: "UP"`.

---

## 6. Pre-Flight Risks & Unresolved Decision Points

Before executing Stage 1 of this integration plan, the following architectural decisions require explicit Owner authorization:

1. **Production Frontend Hosting Choice:**
   - *Option A:* Vercel Pro ($20/month per seat) — full Vercel ecosystem, commercial license.
   - *Option B:* Cloudflare Pages ($0/month) — 100% free commercial use, unlimited bandwidth, edge performance.
2. **Private Document Storage Driver Selection:**
   - *Option A:* Cloudflare R2 ($0/month up to 10 GB, zero egress fees) — decoupled, scalable.
   - *Option B:* Render Persistent Disk ($2.50/month for 10 GB + requires $7/mo Starter backend) — local filesystem, single instance.
   - *Option C:* Supabase Storage ($0/month up to 1 GB) — integrated dashboard, tight storage cap.
3. **Database Maintenance & Keep-Alive Automation:**
   - To prevent Supabase Free tier 7-day inactivity pausing, agree to schedule a daily automated backup script (`npm run backup`) via GitHub Actions or external cron.
