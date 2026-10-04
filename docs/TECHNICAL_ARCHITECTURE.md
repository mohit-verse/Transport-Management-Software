# Technical Architecture

## 1. Purpose

This document defines the technical architecture for the SRL internal web application.

The purpose is to translate the approved business, functional, financial, billing, UI/UX, workflow, audit, security, reporting, and API requirements into an implementation architecture that Codex can follow without inventing conflicting system behavior.

This document defines **how the system should be built**. It does not redefine the business rules already established in the other documentation.

---

## 2. Architecture Principles

The implementation must follow these principles:

1. Business rules are authoritative over convenience.
2. Backend business logic is authoritative over frontend behavior.
3. Financial integrity has priority over UI convenience.
4. Payment Module is the source of truth for actual money movement.
5. Structured data is the source of truth for business records.
6. Audit history is immutable through normal application operations.
7. Role permissions are enforced server-side.
8. Database constraints should protect critical invariants where practical.
9. Multi-record financial operations should be transactional.
10. The system must support multi-year historical records.
11. Avoid unnecessary ERP-style complexity.
12. Avoid duplicate sources of truth.
13. Prefer explicit business services over hidden side effects.
14. Keep operational, financial, document, and configuration responsibilities clearly separated.
15. The implementation must remain maintainable for a small internal team.

---

# 3. System Architecture

The application should use a layered web application architecture:

```text
                    ┌─────────────────────┐
                    │      Browser        │
                    │ Desktop / Mobile    │
                    └──────────┬──────────┘
                               │ HTTPS
                               ▼
                    ┌─────────────────────┐
                    │     Frontend        │
                    │ UI + Client State   │
                    └──────────┬──────────┘
                               │ HTTP API
                               ▼
                    ┌─────────────────────┐
                    │      Backend        │
                    │ API + Auth + RBAC   │
                    │ Business Services   │
                    └───────┬─────┬───────┘
                            │     │
                 ┌──────────┘     └──────────┐
                 ▼                           ▼
        ┌──────────────────┐       ┌──────────────────┐
        │   PostgreSQL     │       │ File/Object      │
        │ Structured Data  │       │ Storage          │
        └──────────────────┘       └──────────────────┘
```

External services may be added where required, but the core application must remain understandable and modular.

---

# 4. Recommended Technology Stack

The following stack is recommended for implementation:

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query for server-state management
- A component library or internally structured component system where appropriate
- Form validation using a schema-based approach

## Backend

- Node.js
- TypeScript
- Express.js

The backend should be organized into controllers/routes, services, validation, authorization, and data-access layers.

## Database

- PostgreSQL

PostgreSQL is the primary source for structured business records.

## ORM / Data Access

Use a typed PostgreSQL-compatible ORM or query layer.

The implementation should prioritize:

- Type safety
- Transactions
- Explicit relations
- Migrations
- Constraint support
- Predictable SQL generation

The final ORM choice should not change the business model defined in `DATA_MODEL.md`.

---

# 5. Repository Architecture

The repository should follow:

```text
srl/
├── AGENTS.md
├── docs/
├── database/
├── backend/
├── frontend/
└── tests/
```

Recommended internal organization:

```text
backend/
├── src/
│   ├── config/
│   ├── middleware/
│   ├── auth/
│   ├── users/
│   ├── trips/
│   ├── parties/
│   ├── vehicle-owners/
│   ├── market-vehicles/
│   ├── own-fleet/
│   ├── payments/
│   ├── bills/
│   ├── bill-designer/
│   ├── documents/
│   ├── reports/
│   ├── audit/
│   ├── search/
│   ├── settings/
│   ├── shared/
│   ├── routes/
│   └── app/
└── tests/
```

Recommended frontend organization:

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── trips/
│   │   ├── parties/
│   │   ├── vehicle-owners/
│   │   ├── market-vehicles/
│   │   ├── own-fleet/
│   │   ├── payments/
│   │   ├── bills/
│   │   ├── bill-designer/
│   │   ├── documents/
│   │   ├── reports/
│   │   ├── users/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── styles/
└── tests/
```

The exact folder naming can vary, but module boundaries should remain clear.

---

# 6. Frontend Architecture

The frontend is responsible for:

- Rendering UI
- Navigation
- Forms
- Client-side validation for user experience
- Server-state fetching/caching
- Loading/error states
- Role-aware UI
- Table/card views
- Filters/search
- Bill Designer interface
- Document upload UI

The frontend must **not** be the authoritative source of business rules.

For example:

```text
Frontend:
"Hide Reverse Payment button for Staff."

Backend:
"Reject payment reversal from Staff."
```

Both are required, but backend enforcement is authoritative.

---

# 7. Server-State Management

API data should be managed as server state rather than duplicated unnecessarily in local component state.

Recommended approach:

- TanStack Query or equivalent
- Query invalidation after mutations
- Optimistic updates only where financial consistency is not endangered
- Explicit refetch/revalidation after financial mutations

Financial mutations should favor correctness over aggressive optimistic UI.

For example, after reversing a payment:

```text
Reverse Payment
      ↓
Server transaction
      ↓
Successful response
      ↓
Invalidate payment/report/settlement queries
      ↓
Fetch authoritative values
```

---

# 8. Frontend Routing

The frontend should use structured routes corresponding to major modules.

Conceptually:

```text
/dashboard

/trips
/trips/:id

/parties
/parties/:id

/vehicle-owners
/vehicle-owners/:id

/market-vehicles
/market-vehicles/:id

/own-fleet
/own-fleet/:id

/payments
/payments/:id

/bills
/bills/:id

/bill-designer
/bill-designer/:id

/documents

/reports

/users
/settings
```

Exact URL naming can be finalized during implementation.

---

# 9. Backend Layering

The backend should separate responsibilities into:

```text
Route / Controller
        ↓
Validation
        ↓
Authorization
        ↓
Business Service
        ↓
Repository / Data Access
        ↓
PostgreSQL
```

### Controller

Handles:

- HTTP request
- HTTP response
- Parameter extraction
- Calling the service

### Validation

Handles:

- Request schema
- Data types
- Required fields
- Business input constraints

### Authorization

Handles:

- Authentication
- Role
- Resource access
- Action permission

### Service

Handles:

- Business logic
- State transitions
- Financial calculations
- Transactions
- Cross-module operations

### Repository/Data Access

Handles:

- Database queries
- Persistence
- Retrieval
- Relations

Business logic should not be hidden inside generic database helpers.

---

# 10. Database Architecture

PostgreSQL is the authoritative store for structured business records.

The database should contain structured records for at least:

- Users
- Parties/Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet Vehicles
- Trips
- Trip Destinations
- Trip financial components
- Payments
- Payment allocations
- Credits
- Bills
- Bill versions
- Bill templates
- Numbering series
- Documents metadata
- Audit events
- Settings
- Financial-year configuration

The exact schema is defined in `DATA_MODEL.md`.

---

# 11. Database Constraints

Critical business invariants should be protected by database constraints where practical.

Examples:

- Unique vehicle number within the applicable vehicle master.
- Unique Payment ID.
- Unique bill number within the required numbering scope.
- Bill version uniqueness per bill.
- Valid foreign-key relationships.
- Valid enum/status values.
- Non-negative amounts where required.
- Required cancellation reason.
- Required reversal reason.

Application-level validation remains necessary even when database constraints exist.

---

# 12. Financial Data Architecture

Financial data has two conceptual layers.

## Obligation / Calculation Layer

Located primarily in:

- Trips
- Bills
- Related financial records

This describes what is due or payable.

## Actual Money Movement Layer

Located in:

- Payment Module

This describes what money actually moved.

The system must not merge these concepts into one generic transaction table unless the implementation explicitly preserves this distinction.

---

# 13. Payment Architecture

Payments should be implemented as first-class financial records.

A payment may be:

- Incoming
- Outgoing

It contains:

- Payment ID
- Date
- Entity
- Category
- Amount
- Mode
- Status
- Relationships
- Allocation

Payment status must support the defined Active/Reversed behavior.

Payments are never deleted.

---

# 14. Financial Transactions

Operations affecting multiple financial records should execute inside database transactions.

Example:

```text
Payment Reversal
    ↓
BEGIN TRANSACTION
    ↓
Validate payment
    ↓
Mark payment reversed
    ↓
Reverse allocations
    ↓
Update credit effects
    ↓
Recalculate affected financial state
    ↓
Create audit event
    ↓
COMMIT
```

If a required step fails, the transaction should roll back.

---

# 15. Payment Allocation Architecture

Payment allocation must be represented explicitly.

This allows the system to support:

- Specific trip allocation
- Specific bill allocation
- Bulk/FIFO allocation
- Credit generation
- Credit utilization
- Reallocation

A completed payment cannot remain partially allocated.

The implementation must preserve enough allocation information to explain how the full payment amount was applied.

---

# 16. FIFO Architecture

FIFO allocation should be implemented as a deterministic business service.

Conceptually:

```text
Payment
  ↓
Identify eligible outstanding receivables
  ↓
Sort by FIFO rule
  ↓
Allocate sequentially
  ↓
If excess remains
  ↓
Generate credit
```

The exact ordering key must follow the business rules defined elsewhere.

FIFO allocation must be auditable.

---

# 17. Trip Architecture

Trips should be treated as the central operational record.

A Trip may connect:

```text
Party/Company
       │
       ├── Trip
       │     ├── Vehicle
       │     ├── Driver
       │     ├── Destinations
       │     ├── Financial obligations
       │     ├── POD
       │     ├── Courier
       │     ├── Issues
       │     ├── Bill
       │     └── Payments
       │
Vehicle Owner / Own Fleet
```

The exact relational model is defined in `DATA_MODEL.md`.

---

# 18. Own Fleet Architecture

Own Fleet is separate from Market Vehicles.

Own Fleet vehicles must support:

- In Trip
- Available
- Under Maintenance
- Sold/Removed

The implementation should derive operational availability from active trip/maintenance state where defined.

Market Vehicles must not receive this own-fleet status lifecycle.

---

# 19. Billing Architecture

Billing is a structured workflow:

```text
Eligible Trips
      ↓
Billing Configuration
      ↓
Numbering Series
      ↓
Bill Template
      ↓
Structured Bill
      ↓
Bill Version
      ↓
PDF Rendering
      ↓
Storage
```

Billing must not rely on permanently positioning a static blank PDF as the final bill layout.

The structured template is the source for bill rendering.

---

# 20. Bill Designer Architecture

The Bill Designer should store a structured representation of the bill rather than only an image/PDF.

Structured elements may include:

- Text
- Tables
- Borders
- Lines
- Dynamic fields
- Images
- Logos
- Signature
- Stamp
- Headers
- Footers
- Spacing
- Alignment
- Repeatable trip rows
- Calculated fields
- Page breaks

The Bill Designer must support dynamic fields from Trip and Master data according to `BILL_DESIGNER_SPEC.md`.

---

# 21. Dynamic Field Architecture

Dynamic fields should be represented as stable field identifiers rather than hard-coded display strings.

Conceptually:

```text
trip.vehicle_number
party.name
party.gstin
trip.loading_date
trip.unloading_date
bill.number
```

The final field registry must cover the approved structured fields from Trips and Masters.

The rendering engine resolves field identifiers against the relevant record context.

---

# 22. Consolidated Bill Architecture

A consolidated bill contains multiple selected trips.

Therefore, the template engine must support repeatable structures.

Conceptually:

```text
Header
  ↓
Repeatable Trip Rows
  ↓
Totals
  ↓
Footer
```

The renderer must be able to flow rows across pages when required.

A static background image must not constrain the number of trip rows.

---

# 23. Bill Version Architecture

Bill corrections use versions:

```text
Bill Number: SRL/26-27/001

v1
v2
v3
```

Rules:

- Same bill number
- New version for correction
- Previous versions read-only
- Latest version current
- No new bill number for correction

Version data must remain structurally connected to the original bill.

---

# 24. PDF Architecture

Generated bill PDFs should be produced from:

```text
Stored Template
      +
Structured Bill Data
      +
Dynamic Field Resolution
      ↓
PDF Renderer
      ↓
PDF File
```

Generated PDFs are stored by default.

Owner may delete the generated PDF.

Deleting a PDF must not delete the structured bill/version data.

The PDF can be regenerated from the structured template and stored data.

---

# 25. Document Storage Architecture

The database should store document metadata.

File storage should store the actual file content.

Conceptually:

```text
Database
├── Document ID
├── Related Entity
├── Document Type
├── Filename
├── Upload Time
├── Uploaded By
├── Size
└── Storage Reference

Object/File Storage
└── Actual File
```

The application must not store large binary files directly in ordinary business tables unless there is a specific technical reason.

---

# 26. Document Access

Private documents must be access-controlled.

A user request should follow:

```text
Authenticated User
       ↓
Authorization Check
       ↓
Document Metadata Check
       ↓
Storage Retrieval
       ↓
File Response
```

Storage credentials must never be exposed to the browser.

---

# 27. Audit Architecture

Audit history should be implemented as an append-oriented record system.

Conceptually:

```text
audit_events
├── id
├── timestamp
├── actor
├── role
├── module
├── entity_type
├── entity_id
├── action
├── description
├── before_value
├── after_value
└── related_entities
```

Exact database column types are implementation details.

Audit records must not be editable or deletable through normal application APIs.

---

# 28. Audit Transaction Boundary

For critical mutations, the audit event should be created within the same database transaction as the business change where practical.

Example:

```text
BEGIN
  Update Payment
  Update Allocation
  Create Audit Event
COMMIT
```

This prevents a successful financial mutation from being committed without its required audit record.

---

# 29. Reporting Architecture

Reports should query authoritative underlying records.

For payment-based financial reporting:

```text
Payment Module
      ↓
Report Query
      ↓
Aggregation
      ↓
Financial Report
```

Do not create a separate manually maintained financial-total table unless it is explicitly designed as a derived/cache layer with a reliable source-of-truth strategy.

The report must always be reconstructable from the underlying payment records.

---

# 30. P&L Architecture

Payment-based business P&L is:

```text
Active Incoming Payments
        -
Active Outgoing Payments
        =
Business P&L
```

Reversed payments are excluded.

Dashboard and reporting calculations should use the same service/query definitions to prevent inconsistent totals.

---

# 31. Global Search Architecture

Global search should search across indexed identifiers and relevant text fields.

Conceptually:

```text
Search Query
    ↓
Search Service
    ├── Trips
    ├── Parties
    ├── Vehicles
    ├── Vehicle Owners
    ├── Bills
    ├── Payments
    └── Documents
```

Search results must be filtered according to the user's authorization.

The search system should return references to source records rather than duplicate full records.

---

# 32. Navigation Context

Navigation state such as:

- Search
- Filters
- Pagination
- Scroll position where practical

should be preserved when navigating between related records.

This is primarily a frontend concern, but APIs must provide stable record identifiers and filterable endpoints so that context can be restored.

---

# 33. Authentication Architecture

Authentication uses:

**Mobile Number + Password**

Password storage must use secure password hashing.

Authentication should use a secure session/token architecture.

The exact implementation can use secure HTTP-only cookies or another appropriately protected session mechanism.

The chosen implementation must satisfy `SECURITY_SPEC.md`.

---

# 34. Authorization Architecture

Authorization should use centralized permission checks.

Conceptually:

```text
Authenticated User
      ↓
Role
      ↓
Permission Check
      ↓
Resource/Action Check
      ↓
Business Service
```

Do not scatter inconsistent role checks throughout individual frontend components.

A centralized backend authorization layer should make permissions explicit and testable.

---

# 35. Validation Architecture

Use schema-based validation at API boundaries.

Validation should occur before business services execute.

Conceptually:

```text
Request
  ↓
Schema Validation
  ↓
Authorization
  ↓
Business Validation
  ↓
Service
```

Frontend validation may mirror the same schemas where practical, but backend validation remains mandatory.

---

# 36. Error Architecture

Errors should use consistent categories.

Examples:

```text
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
BUSINESS_RULE_VIOLATION
INTERNAL_ERROR
```

The frontend should be able to interpret these categories and display appropriate user-facing messages.

---

# 37. Notification Architecture

The current application requires focused notification behavior rather than a generic notification platform.

The architecture should support defined notifications such as:

- Own-fleet document expiry alerts
- Dashboard attention indicators

General reminder/notification automation is not part of the current locked scope unless later approved.

Notification logic must not silently introduce unrelated workflows.

---

# 38. Background Jobs

Background processing may be used for tasks that do not need to block the user's HTTP request.

Potential examples:

- PDF generation for large bills
- File processing
- Document scanning/metadata processing
- Notification generation
- Large report generation

However, background processing must not compromise financial transaction integrity.

Critical payment mutations must complete transactionally before the API reports success.

---

# 39. Caching

Caching may be used for non-critical read-heavy data.

Potential candidates:

- Static configuration
- Bill Designer field metadata
- User interface metadata
- Non-sensitive reference data

Financial totals should not rely on stale cache values.

After financial mutations, affected cached queries must be invalidated or refreshed.

---

# 40. Performance Architecture

The application must remain usable with multi-year historical records.

Use:

- Database indexes
- Pagination
- Efficient joins
- Filtered queries
- Server-side aggregation
- Lazy loading where appropriate
- Document streaming/download mechanisms
- Appropriate caching

Do not load entire historical tables into the browser.

---

# 41. API Security Architecture

API security must include:

- HTTPS
- Authentication
- Backend authorization
- Input validation
- Rate limiting
- Secure session handling
- Controlled error responses
- File access authorization
- Database query protection
- Audit logging
- Secret management

Detailed requirements are defined in `SECURITY_SPEC.md`.

---

# 42. Environment Configuration

Configuration must be separated from source code.

Typical environments:

```text
Development
Testing
Production
```

Environment variables/configuration should contain items such as:

- Database connection
- Authentication/session secrets
- File storage configuration
- External service credentials
- Application URL
- API URL
- Logging configuration

Secrets must never be committed to Git.

A safe `.env.example` should document required variable names without real secrets.

---

# 43. Database Migrations

Database changes must be managed through versioned migrations.

Never rely on manually changing the production database schema without a migration record.

Migration process:

```text
Schema Change
    ↓
Migration File
    ↓
Test
    ↓
Review
    ↓
Apply
```

Destructive migrations require additional care because historical business records must be preserved.

---

# 44. Seed Data

Development/test seed data may be provided for:

- Owner
- Staff
- CA
- Sample parties
- Sample vehicle owners
- Sample vehicles
- Sample trips
- Sample payments
- Sample bills

Seed data must be clearly separated from production data.

Production credentials must never be included in seed files.

---

# 45. Testing Architecture

The project should use multiple testing levels.

## Unit Tests

Test:

- Financial calculations
- FIFO allocation
- Status transitions
- Permission checks
- Validation
- Bill numbering
- Bill versioning

## Integration Tests

Test:

- API + database
- Payment transactions
- Billing workflows
- Document authorization
- Audit creation

## End-to-End Tests

Test critical user workflows such as:

```text
Login
  ↓
Create Trip
  ↓
Complete Trip
  ↓
Upload POD
  ↓
Generate Bill
  ↓
Receive Payment
  ↓
Verify Settlement
  ↓
Verify Report
```

---

# 46. Financial Test Requirements

Financial calculations require stronger testing than ordinary CRUD operations.

Test at minimum:

- Full payment
- Partial payment
- Excess payment
- Credit generation
- Credit utilization
- FIFO
- Payment reallocation
- Payment reversal
- Deduction
- TDS
- Bill payment
- Bill cancellation
- Bill versioning
- Own-fleet expenses
- Recalculated settlement
- Payment-derived P&L

---

# 47. Concurrency Architecture

The application must protect critical operations from race conditions.

Examples:

### Bill Number

Two simultaneous bill-generation requests must not receive the same bill number.

### Payment Allocation

Two simultaneous allocation operations must not allocate the same payment amount twice.

### Own Fleet

Two simultaneous trip assignments must not incorrectly make the same own-fleet vehicle available for multiple active trips.

Use database transactions, constraints, row locking, optimistic concurrency, or equivalent mechanisms as appropriate.

---

# 48. Deployment Architecture

A production deployment should contain:

```text
Internet
   ↓
HTTPS / Reverse Proxy
   ↓
Frontend
   ↓
Backend API
   ↓
PostgreSQL

Backend
   ↓
Private File/Object Storage
```

The exact hosting provider is not part of the business specification.

The deployment must satisfy the security, backup, and availability requirements.

---

# 49. Backup Architecture

Backups should cover:

### Structured Data

- PostgreSQL database
- Audit history
- Configuration required for restoration

### Files

- Documents
- Generated bill PDFs where retained

Backups should be tested through restoration procedures.

A backup that has never been successfully restored must not be assumed reliable.

---

# 50. Logging Architecture

Separate:

### Application Logs

For:

- Errors
- Diagnostics
- Performance
- Infrastructure

### Audit Records

For:

- Business actions
- Financial changes
- Administrative changes

Do not use application logs as a replacement for audit history.

Do not store passwords, tokens, or secrets in logs.

---

# 51. Observability

The production system should provide enough information to diagnose:

- API failures
- Database failures
- PDF generation failures
- File-storage failures
- Authentication failures
- Background-job failures

Logs should include safe correlation information where practical.

A request/correlation ID can help trace:

```text
Frontend request
    ↓
API
    ↓
Service
    ↓
Database
```

without exposing sensitive data.

---

# 52. Data Integrity Rules

The implementation must preserve these architectural invariants:

1. Payment records are never deleted.
2. Reversed payments remain in history.
3. Payment ID remains stable after editing/reallocation.
4. Actual money movement comes from Payment Module.
5. Bill corrections use versions.
6. Cancelled bill numbers are never reused.
7. Audit records are immutable through normal application operations.
8. Structured bill data remains independent from generated PDF files.
9. Market Vehicles do not use own-fleet status states.
10. Own-fleet historical records remain available after Sold/Removed.
11. Historical financial-year records remain accessible.

---

# 53. Avoiding Duplicate Sources of Truth

The system must avoid maintaining competing copies of the same financial fact.

Examples:

### Correct

```text
Payment Module
     ↓
Actual Payment
     ↓
Reports / Outstanding / Settlement
```

### Incorrect

```text
Trip Payment Amount
+
Separate Payment Table
+
Manual Report Total
```

where the three can diverge.

Trip records may reference/display payment information, but actual payment records remain in the Payment Module.

---

# 54. Service Boundaries

Recommended major backend services:

```text
AuthService
UserService
TripService
PartyService
VehicleOwnerService
MarketVehicleService
OwnFleetService
PaymentService
AllocationService
BillingService
BillTemplateService
DocumentService
ReportService
SearchService
AuditService
SettingsService
```

Services may internally share infrastructure utilities, but business ownership should remain clear.

---

# 55. Shared Infrastructure

Common backend infrastructure may include:

```text
Database Client
Transaction Manager
Authentication
Authorization
Validation
Error Handling
Logging
File Storage
PDF Renderer
Audit Writer
Pagination
Search
```

Shared infrastructure must not absorb module-specific business logic.

---

# 56. API and Service Rule

Controllers should remain thin.

Avoid:

```text
Controller
  ├── SQL
  ├── financial calculations
  ├── authorization
  ├── PDF generation
  └── audit logic
```

Prefer:

```text
Controller
   ↓
Validation
   ↓
Authorization
   ↓
Service
   ├── Repository
   ├── Financial logic
   ├── Audit
   └── Other services
```

---

# 57. Codex Implementation Rules

Codex must follow these rules while implementing the project:

1. Read `AGENTS.md` before modifying the project.
2. Read the relevant documentation before changing a module.
3. Do not invent business rules where documentation is explicit.
4. Do not silently modify locked decisions.
5. Do not introduce unrelated ERP functionality.
6. Do not duplicate financial sources of truth.
7. Do not bypass backend authorization.
8. Do not implement payment deletion.
9. Do not implement bill partial-payment status.
10. Do not introduce market-vehicle statuses.
11. Do not make bill corrections consume new bill numbers.
12. Do not treat generated PDFs as the structured bill source of truth.
13. Do not expose private documents publicly.
14. Do not store secrets in source code.
15. Add tests for significant business logic.
16. Update relevant documentation when an approved architectural decision changes.
17. Prefer small, reviewable implementation steps.
18. Do not refactor unrelated modules during feature work without a reason.

---

# 58. Implementation Sequence

The recommended technical implementation sequence is:

```text
1. Repository + project foundation
        ↓
2. Database + migrations
        ↓
3. Authentication + RBAC
        ↓
4. Core masters
        ↓
5. Trip module
        ↓
6. Documents + POD
        ↓
7. Payment Module
        ↓
8. Billing
        ↓
9. Bill Designer
        ↓
10. Reports
        ↓
11. Audit + security hardening
        ↓
12. Global Search
        ↓
13. Dashboard refinement
        ↓
14. Testing
        ↓
15. Deployment
```

Dependencies should be respected.

For example, Billing should not be implemented before the required Trip and Party/Company structures exist.

---

# 59. Definition of Technical Completion

The architecture is considered implemented when:

1. Frontend and backend communicate through documented APIs.
2. PostgreSQL stores authoritative structured business records.
3. Authentication works through Mobile Number + Password.
4. Backend RBAC is enforced.
5. Core masters are implemented.
6. Trip workflows are implemented.
7. Documents/POD are implemented.
8. Payment Module is authoritative for actual money movement.
9. Payment allocation/reversal rules are implemented.
10. Billing and bill versioning are implemented.
11. Bill Designer uses structured templates.
12. Generated bills can be rendered to PDF.
13. Financial Reports derive from Payment Module records.
14. Audit history is created for significant mutations.
15. Security controls are implemented.
16. Global Search works across the approved modules.
17. Historical Financial Year data remains accessible.
18. Automated tests cover critical business logic.
19. Production deployment follows the security architecture.
20. Backup and recovery procedures are documented and tested.

---

# 60. Final Architecture Rule

The implementation should always preserve this hierarchy:

```text
Approved Business Requirements
            ↓
Functional Requirements
            ↓
Workflows / Financial / Billing Rules
            ↓
Technical Architecture
            ↓
API + Database + Services
            ↓
Frontend
```

Technical convenience must not silently override an approved business rule.

When a future requirement conflicts with an existing locked rule, stop and resolve the requirement explicitly before changing the implementation.

---

# 61. Related Documents

Codex should consult the following documents together with this specification:

- `AGENTS.md`
- `PROJECT_OVERVIEW.md`
- `BUSINESS_REQUIREMENTS.md`
- `FUNCTIONAL_REQUIREMENTS.md`
- `ROLES_AND_PERMISSIONS.md`
- `DATA_MODEL.md`
- `PAYMENT_ARCHITECTURE.md`
- `BILLING_ARCHITECTURE.md`
- `BILL_DESIGNER_SPEC.md`
- `UI_UX_SPECIFICATION.md`
- `WORKFLOWS.md`
- `AUDIT_AND_HISTORY.md`
- `SECURITY_SPEC.md`
- `REPORTING_SPEC.md`
- `API_SPECIFICATION.md`

This document is the implementation bridge between those requirements and the actual codebase.

# 62. Explicit Transaction Boundaries

The backend must strictly enforce atomic database transactions for the following operations:

### Trip Creation
Must include: Trip record, initial destination records, initial party and vehicle owner financial records, and Audit event.

### Trip Financial Update
Must include: Updates to 	rip_party_financials / 	rip_vehicle_owner_financials, insertion/deletion of 	rip_other_charges, 	rip_deductions, 	rip_unloading_charges, and Audit event. Recalculation triggers execute within this boundary.

### POD Upload/Registration
Must include: Updates to 	rip_pods (docket info, status), insertion into documents and document_links, and Audit event.

### Payment Creation & Allocation
Must include: Insertion of payments, insertion of payment_allocations, insertion of party_credits (if CREDIT_GENERATED), and Audit event.

### Payment Reversal
Must include: Status update on payments, status updates on cascading payment_allocations (including CREDIT_UTILIZED reversals), and Audit event. Recalculation triggers execute within this boundary.

### Credit Generation
Occurs atomically within Payment Creation. Requires: payments, payment_allocations, and party_credits.

### Credit Utilization
Must include: Insertion of new payment_allocations targeting the original CREDIT_GENERATED source, verification of total limits, and Audit event.

### FIFO Allocation
Must include: Insertion of pointer records in payment_fifo_runs and payment_fifo_run_allocations, bulk insertion of canonical payment_allocations, and Audit event.

### Bill Generation / Regeneration
Must include: Insertion of ills, bulk insertion of ill_items, insertion of the active ill_versions, bulk insertion of ill_version_items, capture of template snapshots, and Audit event.

### Bill Version Creation
Must include: Insertion of new ill_versions, insertion of ill_version_items, updating the previous version to inactive, and Audit event.

### Bill Cancellation
Must include: Updating ills.bill_status to CANCELLED, trigger cascades marking ill_items.is_active = false, removal of active bill references, and Audit event.

### Own-fleet Expense Creation
Must include: Insertion of own_fleet_expense_details (and related destination context), and Audit event.

### Document Replacement/Deletion
Must include: Updating documents.is_deleted or inserting a new documents record, updating document_links, and Audit event.
