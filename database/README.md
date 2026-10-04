# SRL Database Implementation Guide

## 1. Purpose

This directory contains the database layer for the Shri Sanwariya Road Lines (SRL) application.

The database must preserve the complete operational and financial history of the business while maintaining strict separation between:

- Operational records
- Financial obligations/calculations
- Actual money movements
- Billing records
- Documents
- Audit history
- User access

The database is PostgreSQL.

---

## 2. Database Principles

### 2.1 Source of Truth

The database must have clear ownership of each type of information.

| Information | Source of Truth |
|---|---|
| Trip operational data | Trips |
| Party/company master data | Parties |
| Vehicle owner data | Vehicle Owners |
| Market vehicle data | Market Vehicles |
| Own fleet data | Own Fleet |
| Actual money movement | Payments |
| Bill records | Bills |
| Bill versions | Bill Versions |
| Bill numbering | Billing Numbering Series |
| Documents | Documents |
| User identity/roles | Users |
| Audit history | Audit Logs |
| Financial reports | Payment records |

---

## 3. Critical Financial Rule

### Payments are the only source of actual money movement.

A Trip must never create an actual payment record.

A Trip may contain financial obligations and calculated values such as:

- Freight
- Detention
- Unloading charges
- Other charges
- Deductions
- TDS
- Amount receivable/payable

However:

- Advance received is a Payment.
- Balance received is a Payment.
- Payment to a vehicle owner is a Payment.
- Own-fleet diesel payment is a Payment.
- FASTag payment is a Payment.
- Other business payment is a Payment.
- Other business receipt is a Payment.

Financial reports must be generated from active Payment records.

---

## 4. Financial Record Rules

### 4.1 Payment Status

Payments are never physically deleted.

Supported states:

- Active
- Reversed

A reversed payment remains permanently recorded for audit purposes.

Reversal requires:

- Reason
- Reversed by
- Reversal date/time

All allocations and financial calculations must be recalculated after reversal.

---

## 5. Entity Relationships

The main relationships are:

```text
User
 ├── creates/edits records
 └── generates audit history

Party
 ├── has Trips
 ├── has Bills
 ├── has Payments
 └── may have Credit

Vehicle Owner
 ├── owns Market Vehicles
 ├── receives Payments
 └── has Trips

Market Vehicle
 └── belongs to Vehicle Owner

Own Fleet Vehicle
 └── belongs to SRL

Trip
 ├── belongs to Party
 ├── references Market Vehicle OR Own Fleet Vehicle
 ├── may reference Vehicle Owner
 ├── contains financial obligations
 ├── contains POD/documents
 ├── may belong to a Bill
 └── receives Payment allocations

Bill
 ├── belongs to Party/Company
 ├── contains one or more Trips
 ├── has versions
 ├── has generated document files
 └── receives Payment allocations

Payment
 ├── belongs to an entity
 ├── may be allocated to Trip/Bill
 ├── may generate Party/Company credit
 └── contributes to financial reports

Document
 ├── belongs to a supported business record
 └── stores file metadata/reference

Audit Log
 └── records important changes across the system
```

---

## 6. Primary Database Domains

The schema should be organized conceptually into these domains.

### 6.1 Authentication and Users

Includes:

- Users
- Roles
- Account status
- Authentication/security metadata

Roles:

- Owner
- Staff
- CA

Authorization must be enforced by the backend.

---

### 6.2 Party and Company Management

Includes:

- Parties
- Companies
- Party financial position
- Party credit
- Party billing configuration
- Billing numbering series
- Billing template configuration

Party and Company are represented by the Party Master.

Party Type:

```text
MARKET_PARTY
COMPANY
```

---

### 6.3 Vehicle Management

Separate market and own-fleet vehicles.

#### Market Vehicle

Stores:

- Vehicle number
- Vehicle owner reference
- Vehicle owner mobile/reference data where applicable

Market vehicles must not have an operational status field.

#### Own Fleet Vehicle

Stores:

- Vehicle number
- Vehicle details
- Current lifecycle state
- Maintenance information where required
- Historical document relationships

Supported lifecycle states:

```text
IN_TRIP
AVAILABLE
UNDER_MAINTENANCE
SOLD_REMOVED
```

`IN_TRIP` and `AVAILABLE` should be derived from active trip/maintenance state wherever practical.

---

## 7. Trip Data

Trips are permanent operational records.

A Trip may represent:

- Company/Vendorship transport
- Market/Party transport
- Own-fleet transport

The database must preserve historical trips indefinitely.

A Trip may contain:

- Trip identification
- Party/company
- Vehicle
- Vehicle owner where applicable
- Driver mobile
- Origin
- Multiple destinations
- Loading date
- Unloading date
- Operational status
- POD information
- Courier information
- Issues
- Financial obligations
- Billing references
- Payment relationships

---

## 8. Trip Status

Operational lifecycle:

```text
CREATED
LOADING
IN_TRANSIT
COMPLETED
SETTLED
CANCELLED
```

The implementation must distinguish:

- Operational completion
- Party settlement
- Vehicle-owner settlement
- Overall settlement

Settlement must be derived from applicable financial conditions rather than manually forcing arbitrary states.

---

## 9. Trip Financial Structure

Trip financial data represents obligations/calculations.

### Party-side

Possible components:

- Freight
- Detention
- Unloading charges
- Other charges
- Shortage/damage deductions
- TDS

Actual received money must come from Payment records.

### Vehicle-owner-side

Possible components:

- Base freight
- Detention
- Unloading charges
- Other charges
- Shortage/damage deductions

Actual payments must come from Payment records.

Vehicle-owner overpayment must not create a credit balance.

---

## 10. Own Fleet Financial Structure

Own-fleet trips do not have vehicle-owner payable records.

Own-fleet expenses are actual outgoing payments.

Supported categories:

```text
DIESEL
FASTAG
BORDER
LOADING
UNLOADING
OTHER
```

Each applicable expense must ultimately be represented by a Payment record.

Own-fleet expenses may be added even after a trip becomes Settled.

Adding a post-settlement expense must not change the trip status.

The calculated P&L must be recalculated.

---

## 11. Payment Allocation Model

A Payment must support:

### Incoming

- Specific Bill
- Specific Trip
- Bulk/FIFO allocation

### Outgoing

- Vehicle owner
- Own fleet
- Other business payment

### Other Business Receipt

A standalone incoming payment category.

---

## 12. Allocation Rules

Every completed payment must be fully accounted for.

For applicable payments:

```text
Payment Amount
=
Allocated Amount
+
Credit Generated
```

There must not be a completed payment with a permanently unallocated balance.

### Company / Market Party

Excess incoming payment becomes credit.

Credit may later be consumed using FIFO rules.

### Vehicle Owner

No credit balance is created.

The system must prevent overpayment to the extent required by the applicable payable amount.

---

## 13. FIFO

FIFO is used for:

- Bulk incoming payments from companies
- Bulk incoming payments from market parties
- Party/company credit utilization

FIFO must operate against eligible outstanding receivables.

The allocation history must be permanently auditable.

---

## 14. Payment Reallocation

Only Owner can reallocate an existing payment.

Reallocation must:

1. Show a warning.
2. Preserve the same Payment ID.
3. Preserve previous allocation history.
4. Record the new allocation.
5. Recalculate affected balances.
6. Recalculate settlement.
7. Recalculate credits.
8. Recalculate payment-derived reports.

---

## 15. Billing Database Rules

A Bill belongs to one Party/Company.

A Bill can contain:

- One Trip for individual billing
- Multiple Trips for consolidated billing

A Trip may belong to only one active bill.

A Trip cannot be billed before:

```text
Completed
+
POD Received
```

---

## 16. Bill Status

Only these statuses are allowed:

```text
GENERATED
SUBMITTED
PAID
CANCELLED
```

There is no:

```text
DRAFT
PARTIALLY_PAID
```

A bill with partial payment remains:

```text
GENERATED
```

or

```text
SUBMITTED
```

until fully paid.

`PAID` is system-derived from active payment allocations.

---

## 17. Bill Versions

A bill may have multiple versions.

Example:

```text
Bill Number: SRL/26-27/001

Version 1
Version 2
Version 3
```

Rules:

- Same bill number across versions.
- Latest version is current.
- Previous versions are read-only.
- Version creation must be auditable.
- A correction does not generate a new bill number.
- A new bill generates a new bill number.

---

## 18. Bill Numbering

Numbering is controlled by Billing Numbering Series.

Numbering resets every Financial Year.

Example:

```text
FY 2026-27
SRL/26-27/001
SRL/26-27/002

FY 2027-28
SRL/27-28/001
SRL/27-28/002
```

Cancelled bill numbers are never reused.

A company may have multiple numbering series.

The user selects the series when generating a bill.

There is no automatic default series selection unless explicitly configured later.

---

## 19. Bill Cancellation

When a bill is cancelled:

- Status becomes `CANCELLED`.
- Cancellation reason is mandatory.
- Cancelled by is recorded.
- Cancellation timestamp is recorded.
- Trips return to Unbilled.
- Active bill document/details are removed according to storage rules.
- Lightweight cancellation metadata remains permanently.
- The bill cannot be restored.

A replacement bill must receive a new bill number.

---

## 20. Bill Template Data

Bill templates are structured data, not simply background images.

A template may contain:

- Text
- Tables
- Borders
- Lines
- Images
- Logo
- Signature
- Stamp
- Dynamic fields
- Calculated fields
- Headers
- Footers
- Page breaks
- Repeatable trip rows
- Alignment
- Spacing

Templates must support automatic reconstruction from uploaded PDF/JPG/PNG references.

The generated document must be rendered from the structured template.

---

## 21. Dynamic Fields

The Bill Designer must be able to reference structured data from:

- Party Master
- Vehicle Owner Master
- Market Vehicle Master
- Own Fleet Master
- Trip
- Bill
- Payment where applicable
- Business Profile
- Billing configuration

The implementation must not hard-code a tiny fixed list of fields.

Dynamic fields should be organized by source entity.

---

## 22. Documents

Documents store metadata and a reference to the actual stored file.

Metadata should include, where applicable:

- Document ID
- Document type
- File name
- File reference/path
- File size
- Uploaded by
- Upload date/time
- Related entity
- Active/inactive state

Multiple files may exist for the same document type.

---

## 23. Audit History

Important business actions must be auditable.

Examples:

- Create
- Edit
- Payment allocation
- Payment reallocation
- Payment reversal
- FIFO allocation
- Bill generation
- Bill version creation
- Bill cancellation
- Permission-sensitive configuration change
- Document replacement
- Document deletion

Audit records should capture:

- User
- Action
- Entity
- Entity ID
- Timestamp
- Before state where applicable
- After state where applicable
- Reason where required

Audit history is append-only.

---

## 24. Data Integrity

The database must enforce business-critical rules where possible.

Examples:

- Unique vehicle numbers where applicable.
- Unique payment IDs.
- Unique bill number + version combinations.
- Valid foreign-key relationships.
- Valid enum/status values.
- No trip belonging to multiple active bills.
- No payment with invalid allocation totals.
- No invalid negative financial values unless explicitly supported.
- No duplicate numbering within a financial year and series.
- No orphaned financial allocations.

Application-level validation must supplement database constraints.

---

## 25. Financial Year

Financial Year must be represented explicitly.

The system must support:

- Current Financial Year
- Historical Financial Years
- Financial Year filtering
- Bill numbering by Financial Year
- Financial reports by Financial Year

Historical records must remain accessible.

Financial-year changes must never modify historical records.

---

## 26. Reporting Principle

Financial Reports must be generated from Payment records.

For business P&L:

```text
Business P&L
=
Active Incoming Payments
-
Active Outgoing Payments
```

Reversed payments are excluded.

This report is a business-level cash/payment report.

It is not a statutory accounting statement.

CA workflows may use the underlying financial records for formal accounting and tax/ITR work.

---

## 27. Database Migration Rules

All schema changes must be performed through versioned migrations.

Never modify production schema manually without a corresponding migration.

Migration naming should be chronological, for example:

```text
001_create_users.sql
002_create_parties.sql
003_create_vehicles.sql
004_create_trips.sql
005_create_payments.sql
```

The exact migration breakdown can be adjusted during implementation.

---

## 28. Seed Data

Development seed data may include:

- One Owner
- One Staff user
- One CA user
- Sample Party
- Sample Company
- Sample Vehicle Owner
- Sample Market Vehicle
- Sample Own Fleet Vehicle

Seed data must never be treated as production data.

Production credentials must never be committed to the repository.

---

## 29. Database Environment

Database credentials must be supplied through environment variables.

Never hard-code:

- Database passwords
- JWT secrets
- Encryption keys
- Storage credentials
- API keys

Example:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=
```

The exact environment variables will be finalized with the backend architecture.

---

## 30. Implementation Order

The recommended implementation order is:

### Phase 1 — Foundation

1. Users
2. Roles
3. Financial Years
4. Business Settings

### Phase 2 — Masters

5. Parties
6. Vehicle Owners
7. Market Vehicles
8. Own Fleet Vehicles

### Phase 3 — Operations

9. Trips
10. Destinations
11. Trip financial obligations
12. POD/Documents
13. Issues

### Phase 4 — Payments

14. Payments
15. Payment allocations
16. FIFO
17. Credits
18. Payment reversal
19. Payment audit history

### Phase 5 — Billing

20. Billing configuration
21. Numbering series
22. Bills
23. Bill items
24. Bill versions
25. Bill payments
26. Bill cancellation

### Phase 6 — Templates

27. Bill templates
28. Template elements
29. Dynamic fields
30. Template assets
31. Generated documents

### Phase 7 — Audit and Reporting

32. Audit logs
33. Payment-derived financial reporting
34. P&L calculations
35. Financial-year reporting

---

## 31. Implementation Rule for Codex

Before creating a database table, verify that the table corresponds to an approved business requirement.

Do not create tables merely because they are common in ERP/TMS applications.

Do not add:

- Unrequested modules
- Unrequested statuses
- Duplicate financial ledgers
- Duplicate payment records
- Unapproved master fields
- Unapproved workflows

When a requirement is ambiguous, stop and ask for clarification rather than inventing behavior.

---

## 32. Expected Database Deliverables

The database implementation phase should ultimately produce:

```text
database/
├── README.md
├── migrations/
├── seeds/
├── functions/
├── triggers/
└── views/
```

The exact files inside these directories should be created only when required by the implementation.

---

## 33. Completion Criteria

The database phase is complete only when:

- All approved core entities are represented.
- Relationships are correct.
- Financial source-of-truth rules are enforced.
- Payment allocation rules are enforceable.
- Bill numbering is correct across financial years.
- Bill versioning is supported.
- Audit requirements are represented.
- Historical records can be retained indefinitely.
- Role-sensitive operations can be enforced by the backend.
- The schema supports the approved workflows without introducing unrelated functionality.
