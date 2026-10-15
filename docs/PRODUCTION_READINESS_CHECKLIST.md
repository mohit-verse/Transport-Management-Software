# Shri Sanwariya Road Lines (SSRL) — Production Readiness Checklist

**Project:** Shri Sanwariya Road Lines (SSRL) Internal Business Management System  
**Baseline Version:** Phase 4P-E Operational Baseline  
**Date:** October 15, 2026  
**Status:** Complete Audit  
**Production Gate:** **LOCKED (Deployment Strictly Prohibited until Hosting Provider Selected & Approved)**  

---

## 1. Executive Summary

This Production Readiness Checklist documents the operational, architectural, security, storage, recovery, and configuration controls required before deploying the SSRL application to live infrastructure.

Every criterion is verified against the canonical codebase and classified with one of three explicit readiness statuses:
1. **SATISFIED (TEST-VERIFIED):** Fully implemented in the repository, validated by automated integration and regression suites.
2. **READY FOR HOSTING (CONFIG-DRIVEN):** Fully implemented in application logic; activates automatically upon deployment when production environment variables are provided.
3. **OUTSTANDING PREREQUISITE (REQUIRES CLOUD/HOSTING PROVIDER):** Host-level, infrastructure-level, or provider-dependent operational control that cannot be executed in local isolation without a selected hosting platform.

---

## 2. Checklist Matrix

### 2.1 Database & Schema Invariants

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| DB-01 | Canonical schema completeness: 40 tables, 27 domain functions, 63 triggers, and 86 dynamic field definitions | **SATISFIED (TEST-VERIFIED)** | `migrate.ts` schema-completeness check against `CANONICAL_TABLES_001`, `CANONICAL_FUNCTIONS_001`, `CANONICAL_TRIGGERS_001`. Verified in `staging-deployment.test.ts` and `backup-automation.test.ts`. |
| DB-02 | Canonical POD data storage in single canonical table `trip_pods` | **SATISFIED (TEST-VERIFIED)** | `trip_pods` is the sole canonical table. Schema check asserts all 10 columns exist, `pod_details` does not exist, and arbitrary queries to `pod_details` throw errors. |
| DB-03 | Authoritative Payment Module as single source of truth for money movement | **SATISFIED (TEST-VERIFIED)** | Enforced via `payments` and `payment_allocations`. Net P&L = Active Incoming - Active Outgoing. Reversed payments contribute ₹0. Verified across `payments.test.ts`, `reports.test.ts`, and `staging-deployment.test.ts`. |
| DB-04 | Deferred constraint triggers for payment and bill integrity | **SATISFIED (TEST-VERIFIED)** | Enforced at transaction commit via `payments_integrity_deferred`, `payment_allocations_integrity_deferred`, `bills_integrity_deferred`, `bill_items_integrity_deferred`, `bill_versions_integrity_deferred`. |
| DB-05 | Historical structured record immutability and append-only audit trail | **SATISFIED (TEST-VERIFIED)** | DB triggers `reject_core_delete()`, `guard_bill_version_snapshot()`, and `bill_version_items_append_only()` prohibit deletion or retroactive tampering of financial and billing records. |
| DB-06 | Migration runner transactional idempotency and safe baselining | **SATISFIED (TEST-VERIFIED)** | `migrate.ts` aborts on partial schemas, applies canonical seeds transactionally, tracks applied migrations in `schema_migrations`, and never baselines incomplete databases. |

---

### 2.2 Persistent Storage & Document Management

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| ST-01 | Persistent storage directory isolation (`storage/documents`, `storage/bills`, `storage/templates`) | **SATISFIED (TEST-VERIFIED)** | `LocalStorageService` manages dedicated subdirectories. Validated in `deployment-config.test.ts` and `staging-deployment.test.ts`. |
| ST-02 | Local filesystem path traversal protection | **SATISFIED (TEST-VERIFIED)** | `sanitizeKey()` strips leading slashes, path traversal sequences (`../`), null bytes, and normalizes paths within `STORAGE_DIR`. Rejection verified by test suite. |
| ST-03 | Secure stream-based document retrieval with RBAC enforcement | **SATISFIED (TEST-VERIFIED)** | Documents streamed via `storageService.getStream(key)` with MIME headers and `Content-Disposition`. Unauthorized roles and unauthenticated callers receive HTTP 401/403. |
| ST-04 | Physical storage reconciliation engine | **SATISFIED (TEST-VERIFIED)** | `reconcileStorage({ dryRun: true })` cross-references physical storage against active database references (`documents`, `bill_versions`, `bill_template_assets`), reporting 0 missing and 0 orphans. |
| ST-05 | Storage persistence across container restart and host reboot | **READY FOR HOSTING (CONFIG-DRIVEN)** | Tested locally via simulated process restart in `staging-deployment.test.ts`. Requires volume mount (Docker `-v`, Docker Compose `volumes:`, Kubernetes `PersistentVolumeClaim`) in hosting manifest. |
| ST-06 | Multi-node storage synchronization & object storage migration path | **READY FOR HOSTING (CONFIG-DRIVEN)** | `StorageService` interface abstracts filesystem operations. Drop-in S3/GCS adapter (`S3StorageService`) can be plugged in without changing domain controllers or services. |

---

### 2.3 Security, TLS & RBAC Hardening

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| SEC-01 | Role-Based Access Control (RBAC) enforced strictly on backend | **SATISFIED (TEST-VERIFIED)** | `OWNER`, `STAFF`, and `CA` role permissions validated. `STAFF` blocked from payment reversal (HTTP 403); `CA` blocked from mutations (HTTP 403) while retaining read-only reporting access (HTTP 200). |
| SEC-02 | Password hashing using secure bcrypt algorithm | **SATISFIED (TEST-VERIFIED)** | All passwords hashed using `bcrypt` (10 rounds). Plaintext passwords never stored in database or recorded in application logs. |
| SEC-03 | Secure HTTP headers via Helmet | **SATISFIED (TEST-VERIFIED)** | Production HTTP responses include HSTS (`Strict-Transport-Security: max-age=15552000; includeSubDomains`), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`. |
| SEC-04 | Strict Cross-Origin Resource Sharing (CORS) allowlisting | **SATISFIED (TEST-VERIFIED)** | Zod schema rejects wildcard `*` in production mode. Dynamic origin checker allows configured origins (`CORS_ORIGIN`) and blocks unauthorized origins with HTTP 403 / CORS error. |
| SEC-05 | Rate-limiting & brute-force throttling on authentication endpoints | **SATISFIED (TEST-VERIFIED)** | Express rate limiter (`rateLimit`) throttles consecutive failed login requests by IP to protect against credential stuffing. |
| SEC-06 | Transport Layer Security (HTTPS/TLS) termination | **OUTSTANDING PREREQUISITE (REQUIRES CLOUD/HOSTING PROVIDER)** | Application is reverse-proxy ready (behind Nginx, Caddy, Cloudflare, AWS ALB, or GCP Cloud Load Balancing). Production deployment must bind SSL/TLS certificates (e.g., Let's Encrypt / ACM). |

---

### 2.4 Secrets & Configuration Management

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| CFG-01 | Zod-validated environment schema (`config/index.ts`) | **SATISFIED (TEST-VERIFIED)** | Strict validation on startup: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `STORAGE_DIR`, `CORS_ORIGIN`. Unsafe production combinations cause immediate process exit with clear diagnostic errors. |
| CFG-02 | Minimum secret length enforcement | **SATISFIED (TEST-VERIFIED)** | `JWT_SECRET` must be at least 32 characters in production. Tested in `deployment-config.test.ts`. |
| CFG-03 | Credential protection during backup and restore | **SATISFIED (TEST-VERIFIED)** | Database passwords are passed via `PGPASSWORD` environment variable, never as command-line arguments. Logs and manifests redact passwords (`***`). Tested in `backup-automation.test.ts`. |
| CFG-04 | Initial Owner provisioning CLI script | **SATISFIED (TEST-VERIFIED)** | `seed:owner` script securely provisions initial administrative account without hardcoding credentials in git. Tested in `seed-owner.test.ts`. |
| CFG-05 | Secrets manager integration (Cloud KMS / AWS Secrets Manager / Vault) | **READY FOR HOSTING (CONFIG-DRIVEN)** | Application reads standard environment variables. Cloud secrets manager can inject environment variables into container runtime at pod/container initialization. |

---

### 2.5 Backup, Retention & Disaster Recovery

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| BKP-01 | Provider-neutral automated backup engine (`pg_dump -Fc`) | **SATISFIED (TEST-VERIFIED)** | Implemented in `scripts/backup.ts`. Produces binary custom-format dump, storage snapshot directory, and SHA-256 JSON manifest. Tested in `backup-automation.test.ts`. |
| BKP-02 | Archive inspection and integrity verification (`pg_restore -l`) | **SATISFIED (TEST-VERIFIED)** | `createBackup` automatically runs `pg_restore -l` to verify dump table of contents before certifying manifest as `VERIFIED`. |
| BKP-03 | Lockfile concurrency protection (`.backup.lock`) | **SATISFIED (TEST-VERIFIED)** | Prevents overlapping backup jobs. Rejects concurrent runs with `BackupLockError`; safely overrides stale lockfiles (> 30 min) from dead PIDs. |
| BKP-04 | Safe retention policy pruner | **SATISFIED (TEST-VERIFIED)** | `applyRetentionPolicy` prunes expired backups beyond retention window (`BACKUP_RETENTION_DAYS`) while strictly preserving minimum count (`BACKUP_RETENTION_COUNT`) and current backup. |
| BKP-05 | Automated recovery and reconciliation engine (`scripts/restore.ts`) | **SATISFIED (TEST-VERIFIED)** | Recreates clean target DB, executes `pg_restore --exit-on-error`, restores storage files, and validates canonical schema (40 tables, 27 functions, 63 triggers, 86 dynamic fields), Net P&L, and 0 missing files. |
| BKP-06 | Host-level scheduled backup trigger (Cron / Task Scheduler / Systemd) | **OUTSTANDING PREREQUISITE (REQUIRES CLOUD/HOSTING PROVIDER)** | Provider-neutral scheduling templates documented in `BACKUP_AND_RESTORE_RUNBOOK.md`. Must be provisioned on host/orchestrator upon environment provisioning. |
| BKP-07 | Continuous WAL Archiving & Point-In-Time Recovery (PITR) | **OUTSTANDING PREREQUISITE (REQUIRES CLOUD/HOSTING PROVIDER)** | PostgreSQL WAL archiving parameters (`archive_mode = on`, `archive_command`) documented. Requires dedicated remote storage bucket (S3/GCS) on production host. |

---

### 2.6 Process Management & Graceful Lifecycle

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| PROC-01 | Graceful process shutdown on SIGTERM / SIGINT | **SATISFIED (TEST-VERIFIED)** | Express server executes `server.closeIdleConnections()` and `server.close()` with graceful drain before process exit. Verified in `staging-deployment.test.ts`. |
| PROC-02 | Natural test suite exit without `--forceExit` | **SATISFIED (TEST-VERIFIED)** | Node `fetch` keep-alive connections closed via `Connection: close`; port listener teardown cleans all open sockets; tests exit naturally. |
| PROC-03 | Process supervisor / container restart policy | **READY FOR HOSTING (CONFIG-DRIVEN)** | Application handles unclean termination safely. Production orchestrator must declare `restart: unless-stopped` (Docker) or `restartPolicy: Always` (Kubernetes). |

---

### 2.7 Logging, Monitoring & Health Probing

| ID | Control / Requirement | Status | Verification & Evidence |
|---|---|---|---|
| MON-01 | Structured JSON application logging via Pino | **SATISFIED (TEST-VERIFIED)** | Logs output in JSON format with timestamps, process IDs, request context, and error stack traces. |
| MON-02 | Log sanitization of sensitive parameters | **SATISFIED (TEST-VERIFIED)** | Passwords, tokens, and authorization headers redacted in logs and error responses. |
| MON-03 | Liveness and readiness health check endpoint (`/api/health`) | **SATISFIED (TEST-VERIFIED)** | `GET /api/health` probes database connectivity and returns HTTP 200 with `{ status: 'ok', database: 'connected' }`. Responds HTTP 503 if DB is unreachable. |
| MON-04 | Host-level metric collection & error alerting (Prometheus / Datadog / CloudWatch) | **OUTSTANDING PREREQUISITE (REQUIRES CLOUD/HOSTING PROVIDER)** | Infrastructure metric scraping and alert channels (Slack/Email/SMS on process crash, 5xx spike, or disk exhaustion) must be configured on selected host. |

---

### 2.8 Accepted Backlog & Non-Blocking Gaps

| ID | Item / Feature | Impact Assessment | Acceptance Status |
|---|---|---|---|
| BL-01 | UI System Settings Page (`/settings/system`) | Administrative convenience. All system settings can be configured via environment variables and direct business settings table. | **ACCEPTED BACKLOG (NON-BLOCKING)** |
| BL-02 | UI User Management Page (`/settings/users`) | Operational convenience. Users can be provisioned via `seed:owner` CLI script and administrative DB procedures. | **ACCEPTED BACKLOG (NON-BLOCKING)** |
| BL-03 | In-App Notification Bell Component | Informational UI feature. All core operational workflows, statuses, alerts, and audit records are fully accessible via domain tables. | **ACCEPTED BACKLOG (NON-BLOCKING)** |

---

## 3. Production Deployment Sign-Off Gate

| Gate Step | Description | Authority | Status |
|---|---|---|---|
| Gate 1 | Codebase, packaging, and configuration audit | Lead Engineer | **APPROVED (PASSED)** |
| Gate 2 | Automated recovery, backup, and restore validation | QA / DevOps | **APPROVED (PASSED)** |
| Gate 3 | Isolated staging deployment and operational rehearsal | System Architect | **APPROVED (PASSED)** |
| Gate 4 | Host platform selection & infrastructure provisioning | Business Owner | **PENDING EXPLICIT USER APPROVAL** |
| Gate 5 | Live production deployment execution | Owner & Lead Engineer | **STRICTLY LOCKED** |

> [!CAUTION]
> **PRODUCTION DEPLOYMENT GATE IS LOCKED.**  
> Under no circumstances should the application be deployed to production or connected to live infrastructure until Gate 4 is formally approved by the business owner.
