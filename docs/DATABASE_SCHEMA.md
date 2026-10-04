# Database Schema Specification

## 1. Purpose

This document defines the PostgreSQL database model for the SRL internal web application.

It translates the approved business, financial, billing, audit, reporting, security, workflow, and technical requirements into a structured database design.

The database must preserve the distinction between:

- Operational records and obligations
- Actual money movement
- Billing records
- Documents
- Audit history
- Configuration

PostgreSQL is the authoritative store for structured business data.

---

## 2. Database Principles

1. PostgreSQL is the primary structured-data store.
2. Every major business entity has a stable primary key.
3. Foreign keys preserve relationships between records.
4. Critical business invariants should be protected by database constraints where practical.
5. Financial mutations must use database transactions.
6. Payments are never physically deleted.
7. Audit records are append-oriented and immutable through normal application APIs.
8. Historical Financial Year records remain accessible.
9. Structured bill data is independent from generated PDF files.
10. Document metadata is stored separately from file content.
11. Avoid duplicate sources of truth.
12. Monetary values use exact decimal types, never floating point.
13. System event timestamps use timezone-aware timestamps.
14. Business dates remain distinct from audit/system timestamps.

---

## 3. Core Entities

The core database entities are:

```text
users
financial_years
business_settings

parties
party_billing_configs

vehicle_owners
market_vehicles
own_fleet_vehicles

trips
trip_destinations
trip_other_charges
trip_deductions
trip_issues

payments
payment_allocations
party_credits
payment_attachments
other_business_categories

bills
bill_versions
bill_version_trips
bill_templates
bill_numbering_series

documents
document_history

audit_events
```

Supporting tables may be added during implementation where required, but must not introduce conflicting business behavior.

---

## 4. Identifier Strategy

Each major entity should use a stable internal primary key, preferably UUID.

Business identifiers remain separate from database primary keys.

Examples:

- Trip Number
- Payment ID
- Bill Number
- Vehicle Number
- LR Number
- Invoice Number
- Courier Docket Number

Business identifiers must not be treated as authorization credentials.

---

# 5. Users

## Table: `users`

Purpose: application authentication and role management.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Required |
| mobile | VARCHAR | Required, unique |
| password_hash | TEXT | Required |
| role | ENUM | OWNER / STAFF / CA |
| is_active | BOOLEAN | Required |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Rules:

- Mobile number is the login identifier.
- Passwords are stored only as secure hashes.
- Only Owner manages users.
- Deactivated users cannot perform new authenticated actions.
- Passwords and authentication secrets never appear in audit data.

---

# 6. Financial Years

## Table: `financial_years`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| label | VARCHAR | Required, unique |
| start_date | DATE | Required |
| end_date | DATE | Required |
| is_active | BOOLEAN | Required |
| created_at | TIMESTAMPTZ | Required |

Example:

```text
2026-27
2027-28
2028-29
```

Bill numbering resets for every Financial Year.

---

# 7. Business Settings

## Table: `business_settings`

Stores application-level configuration such as:

- Business profile
- Payment settings
- Trip/operational settings
- Document/storage settings
- Notification settings
- Identifier settings
- Security/account settings

Owner-only settings must be protected by backend authorization and audited.

Settings requiring relational integrity should use dedicated tables rather than unrestricted JSON.

---

# 8. Parties / Companies

## Table: `parties`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Required |
| primary_mobile | VARCHAR | Required |
| full_address | TEXT | Required |
| city | VARCHAR | Required |
| state | VARCHAR | Required |
| pin_code | VARCHAR | Required |
| gstin | VARCHAR | Nullable |
| party_type | ENUM | MARKET_PARTY / COMPANY |
| tds_applicable | BOOLEAN | Required |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

One record represents either a Market Party or Company.

One billing address and one GSTIN are represented by the approved Party Master fields.

---

# 9. Party Billing Configuration

## Table: `party_billing_configs`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| party_id | UUID | FK → parties |
| billing_mode | ENUM | INDIVIDUAL / CONSOLIDATED |
| template_id | UUID | FK → bill_templates |
| tds_treatment | VARCHAR/ENUM | Defined configuration |
| required_fields | JSONB | Structured configuration |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Only Owner can modify billing configuration.

Staff can use the existing configuration.

---

# 10. Vehicle Owners

## Table: `vehicle_owners`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| name | VARCHAR | Required |
| mobile | VARCHAR | Required |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Market vehicles reference their vehicle owner through this table.

---

# 11. Market Vehicles

## Table: `market_vehicles`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| vehicle_number | VARCHAR | Required, indexed |
| vehicle_owner_id | UUID | FK → vehicle_owners |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Market Vehicles have **no vehicle status field**.

Vehicle assignment to trips is represented by the Trip relationship.

---

# 12. Own Fleet Vehicles

## Table: `own_fleet_vehicles`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| vehicle_number | VARCHAR | Required, unique |
| state | ENUM | IN_TRIP / AVAILABLE / UNDER_MAINTENANCE / SOLD_REMOVED |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

The implementation may derive `IN_TRIP` and `AVAILABLE` from active-trip/maintenance state rather than storing them independently, provided contradictory states cannot occur.

---

# 13. Trips

## Table: `trips`

The Trip is the central operational record.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trip_number | VARCHAR | Required, unique |
| party_id | UUID | FK → parties |
| vehicle_owner_id | UUID | Nullable FK → vehicle_owners |
| market_vehicle_id | UUID | Nullable FK → market_vehicles |
| own_fleet_vehicle_id | UUID | Nullable FK → own_fleet_vehicles |
| driver_mobile | VARCHAR | Required |
| from_location | TEXT | Required |
| loading_date | DATE | Required |
| unloading_date | DATE | Nullable until known |
| trip_relationship | ENUM | MARKET / COMPANY / OWN_FLEET |
| status | ENUM | Lifecycle status |
| pod_status | ENUM | POD lifecycle status |
| docket_number | VARCHAR | Nullable |
| pod_received_at | TIMESTAMPTZ | Nullable |
| courier_sent_at | TIMESTAMPTZ | Nullable |
| cancelled_at | TIMESTAMPTZ | Nullable |
| cancellation_reason | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |

Conditional relationship rules are enforced in the service layer and, where practical, through database constraints.

For an OWN_FLEET trip, the own-fleet vehicle is required and market vehicle/vehicle-owner fields are null.

For a MARKET trip, the market vehicle and vehicle owner are required.

---

# 14. Trip Destinations

## Table: `trip_destinations`

Supports multiple destinations and destination-specific unloading charges.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trip_id | UUID | FK → trips |
| sequence | INTEGER | Required |
| destination | TEXT | Required |
| party_unloading_charge | NUMERIC(14,2) | Default 0 |
| owner_unloading_charge | NUMERIC(14,2) | Default 0 |
| own_fleet_unloading_charge | NUMERIC(14,2) | Default 0 where applicable |
| created_at | TIMESTAMPTZ | Required |

Unique constraint:

```text
(trip_id, sequence)
```

---

# 15. Trip Other Charges

## Table: `trip_other_charges`

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trip_id | UUID | FK → trips |
| side | ENUM | PARTY / VEHICLE_OWNER |
| charge_name | VARCHAR | Required |
| amount | NUMERIC(14,2) | Required |
| remark | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |

Multiple entries are allowed.

Party-side and vehicle-owner-side charges can differ.

---

# 16. Trip Deductions

## Table: `trip_deductions`

Actual financial deductions are separate from issue flags.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| trip_id | UUID | FK → trips |
| side | ENUM | PARTY / VEHICLE_OWNER |
| deduction_type | VARCHAR | Required |
| amount | NUMERIC(14,2) | Required |
| remark | TEXT | Nullable |
| created_at | TIMESTAMPTZ | Required |

An issue does not automatically create a deduction.

---

# 17. Trip Issues

## Table: `trip_issues`

Issues such as shortage or damage are operational records.

| Field | Type |
|---|---|
| id | UUID |
| trip_id | UUID |
| issue_type | VARCHAR |
| description | TEXT |
| status | ENUM |
| resolved_at | TIMESTAMPTZ |
| resolved_by | UUID |
| created_at | TIMESTAMPTZ |

An issue may be resolved without any financial deduction.

---

# 18. Trip Financial Obligations

Stable core financial fields may be stored on `trips`.

Examples:

| Field | Type |
|---|---|
| party_freight | NUMERIC(14,2) |
| vehicle_owner_freight | NUMERIC(14,2) |
| party_detention | NUMERIC(14,2) |
| vehicle_owner_detention | NUMERIC(14,2) |
| tds_amount | NUMERIC(14,2) |

Derived values such as outstanding balances should not be independently editable.

Actual money received/paid must never be duplicated into Trip payment fields.

Actual money movement is stored in `payments`.

---

# 19. Payments

## Table: `payments`

The Payment Module is the authoritative source of actual money movement.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| payment_id | VARCHAR | Required, unique |
| payment_date | DATE | Required |
| type | ENUM | INCOMING / OUTGOING |
| entity_type | ENUM | PARTY / VEHICLE_OWNER / OWN_FLEET / OTHER_BUSINESS |
| party_id | UUID | Nullable FK |
| vehicle_owner_id | UUID | Nullable FK |
| own_fleet_vehicle_id | UUID | Nullable FK |
| category | VARCHAR | Required |
| amount | NUMERIC(14,2) | Required, > 0 |
| mode | ENUM | UPI / BANK_TRANSFER / CASH |
| status | ENUM | ACTIVE / REVERSED |
| created_by | UUID | FK → users |
| created_at | TIMESTAMPTZ | Required |
| updated_at | TIMESTAMPTZ | Required |
| reversed_by | UUID | Nullable FK |
| reversed_at | TIMESTAMPTZ | Nullable |
| reversal_reason | TEXT | Nullable |

Payments are never physically deleted.

Payment ID remains stable after edits.

---

# 20. Payment Allocations

## Table: `payment_allocations`

Represents how an actual payment amount was applied.

| Field | Type | Rules |
|---|---|---|
| id | UUID | Primary key |
| payment_id | UUID | FK → payments |
| allocation_type | ENUM | BILL / TRIP / CREDIT / OTHER |
| bill_id | UUID | Nullable FK |
| trip_id | UUID | Nullable FK |
| amount | NUMERIC(14,2) | Required |
| allocation_method | ENUM | SPECIFIC / FIFO / CREDIT |
| allocation_date | TIMESTAMPTZ | Required |
| created_by | UUID | FK → users |

A completed payment cannot remain partially allocated.

The sum of active allocations must equal the payment amount.

---

# 21. Party Credits

## Table: `party_credits`

Credits are applicable to Companies and Market Parties.

| Field | Type |
|---|---|
| id | UUID |
| party_id | UUID |
| source_payment_id | UUID |
| generated_amount | NUMERIC(14,2) |
| utilized_amount | NUMERIC(14,2) |
| remaining_amount | NUMERIC(14,2) |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

Conceptually:

```text
remaining_amount =
generated_amount - utilized_amount
```

Vehicle-owner overpayments do not create a carried-forward vehicle-owner credit.

---

# 22. Payment Attachments

## Table: `payment_attachments`

| Field | Type |
|---|---|
| id | UUID |
| payment_id | UUID |
| document_id | UUID |
| created_at | TIMESTAMPTZ |

---

# 23. Other Business Categories

## Table: `other_business_categories`

Used for:

- Other Business Payment
- Other Business Receipt

| Field | Type |
|---|---|
| id | UUID |
| name | VARCHAR |
| type | ENUM |
| is_active | BOOLEAN |
| created_at | TIMESTAMPTZ |

The actual financial transaction remains a Payment record.

---

# 24. Bills

## Table: `bills`

| Field | Type |
|---|---|
| id | UUID |
| bill_number | VARCHAR |
| party_id | UUID |
| billing_mode | ENUM |
| current_version_id | UUID |
| status | ENUM |
| financial_year_id | UUID |
| numbering_series_id | UUID |
| generated_at | TIMESTAMPTZ |
| submitted_at | TIMESTAMPTZ |
| paid_at | TIMESTAMPTZ |
| cancelled_at | TIMESTAMPTZ |
| cancellation_reason | TEXT |
| cancelled_by | UUID |
| created_by | UUID |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

Bill statuses are exactly:

```text
GENERATED
SUBMITTED
PAID
CANCELLED
```

There is no Partially Paid status.

---

# 25. Bill Versions

## Table: `bill_versions`

| Field | Type |
|---|---|
| id | UUID |
| bill_id | UUID |
| version_number | INTEGER |
| template_id | UUID |
| structured_content | JSONB |
| total_amount | NUMERIC(14,2) |
| pdf_document_id | UUID |
| created_by | UUID |
| created_at | TIMESTAMPTZ |
| is_current | BOOLEAN |

Unique constraint:

```text
(bill_id, version_number)
```

Previous versions are read-only.

---

# 26. Bill Version Trips

## Table: `bill_version_trips`

Preserves which trips were included in each bill version.

| Field | Type |
|---|---|
| id | UUID |
| bill_version_id | UUID |
| trip_id | UUID |
| sequence | INTEGER |
| billed_amount | NUMERIC(14,2) |

This allows historical reconstruction of a bill version.

---

# 27. Bill Templates

## Table: `bill_templates`

| Field | Type |
|---|---|
| id | UUID |
| name | VARCHAR |
| billing_mode | ENUM |
| structured_definition | JSONB |
| version | INTEGER |
| is_active | BOOLEAN |
| created_by | UUID |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

The structured definition contains editable bill elements.

---

# 28. Bill Numbering Series

## Table: `bill_numbering_series`

| Field | Type |
|---|---|
| id | UUID |
| party_id | UUID |
| financial_year_id | UUID |
| name | VARCHAR |
| prefix | VARCHAR |
| next_number | INTEGER |
| is_active | BOOLEAN |
| created_at | TIMESTAMPTZ |
| updated_at | TIMESTAMPTZ |

Example:

```text
FY 2026–27
Prefix: SRL/26-27/
Next: 001
```

Numbering resets for each Financial Year.

Cancelled bill numbers are never reused.

---

# 29. Documents

## Table: `documents`

Stores document metadata, not the actual file content.

| Field | Type |
|---|---|
| id | UUID |
| document_type | VARCHAR |
| entity_type | VARCHAR |
| entity_id | UUID |
| file_name | VARCHAR |
| mime_type | VARCHAR |
| file_size | BIGINT |
| storage_reference | TEXT |
| uploaded_by | UUID |
| uploaded_at | TIMESTAMPTZ |
| is_active | BOOLEAN |
| deleted_at | TIMESTAMPTZ |
| deleted_by | UUID |

Actual files remain in the selected file/object storage system.

---

# 30. Document History

## Table: `document_history`

Used when documents are replaced or removed and historical metadata must remain.

| Field | Type |
|---|---|
| id | UUID |
| document_id | UUID |
| action | ENUM |
| previous_reference | TEXT |
| replacement_reference | TEXT |
| document_type | VARCHAR |
| document_number | VARCHAR |
| expiry_date | DATE |
| action_by | UUID |
| action_at | TIMESTAMPTZ |

---

# 31. Audit Events

## Table: `audit_events`

| Field | Type |
|---|---|
| id | UUID |
| occurred_at | TIMESTAMPTZ |
| actor_user_id | UUID |
| actor_role | ENUM |
| module | VARCHAR |
| entity_type | VARCHAR |
| entity_id | UUID |
| action | VARCHAR |
| description | TEXT |
| before_data | JSONB |
| after_data | JSONB |
| related_entities | JSONB |

Audit records are append-oriented and cannot be edited/deleted through normal application APIs.

Passwords, tokens, and secrets must never be stored in audit data.

---

# 32. Enumerations

Required controlled values include:

## User Role

```text
OWNER
STAFF
CA
```

## Party Type

```text
MARKET_PARTY
COMPANY
```

## Trip Relationship

```text
MARKET
COMPANY
OWN_FLEET
```

## Payment Type

```text
INCOMING
OUTGOING
```

## Payment Status

```text
ACTIVE
REVERSED
```

## Payment Mode

```text
UPI
BANK_TRANSFER
CASH
```

## Bill Status

```text
GENERATED
SUBMITTED
PAID
CANCELLED
```

## Billing Mode

```text
INDIVIDUAL
CONSOLIDATED
```

## Own Fleet State

```text
IN_TRIP
AVAILABLE
UNDER_MAINTENANCE
SOLD_REMOVED
```

---

# 33. Trip Lifecycle

The database/service layer must support the documented lifecycle:

```text
CREATED
IN_PROGRESS
COMPLETED
SETTLED
CANCELLED
```

The exact internal enum names may differ, but the state machine must follow `WORKFLOWS.md`.

POD and courier events should remain separately represented where required.

---

# 34. Settlement

Settlement should be derived from applicable financial obligations and active payment/allocation state where practical.

For market trips:

```text
Party settlement
+
Vehicle-owner settlement
=
Trip settlement
```

For own-fleet trips:

```text
Party settlement
=
Trip settlement
```

Avoid manually maintained settlement flags that can contradict payment data.

---

# 35. Major Relationships

```text
USER
 ├── PAYMENTS
 ├── BILLS
 ├── DOCUMENTS
 └── AUDIT_EVENTS

PARTY
 ├── TRIPS
 ├── BILLS
 ├── INCOMING PAYMENTS
 └── CREDITS

VEHICLE_OWNER
 ├── MARKET_VEHICLES
 ├── TRIPS
 └── OUTGOING PAYMENTS

MARKET_VEHICLE
 └── TRIPS

OWN_FLEET_VEHICLE
 └── TRIPS

TRIP
 ├── PARTY
 ├── VEHICLE_OWNER
 ├── MARKET_VEHICLE
 ├── OWN_FLEET_VEHICLE
 ├── DESTINATIONS
 ├── CHARGES
 ├── DEDUCTIONS
 ├── ISSUES
 ├── DOCUMENTS
 ├── BILL_VERSIONS
 └── PAYMENT_ALLOCATIONS

PAYMENT
 ├── ALLOCATIONS
 ├── PARTY_CREDIT
 ├── ATTACHMENTS
 └── AUDIT_EVENTS

BILL
 ├── VERSIONS
 ├── VERSION_TRIPS
 ├── NUMBERING_SERIES
 ├── TEMPLATE
 ├── PAYMENT_ALLOCATIONS
 └── AUDIT_EVENTS
```

---

# 36. Foreign-Key Deletion Rules

Critical historical relationships must not be destroyed by cascading deletes.

Examples:

- A Party with Trips cannot simply be deleted.
- A Vehicle Owner with Payments cannot simply be deleted.
- A Trip with Payment Allocations cannot simply be deleted.
- A Payment cannot be deleted.
- A Bill with financial history cannot simply be deleted.

Use deactivation, cancellation, reversal, or removal states according to the relevant business rules.

---

# 37. Monetary Types

All monetary values must use exact decimal types such as:

```text
NUMERIC(14,2)
```

Never use floating-point types for money.

This applies to:

- Freight
- Detention
- Unloading
- Other charges
- Deductions
- TDS
- Payments
- Credits
- Bill totals
- Expenses
- P&L calculations

---

# 38. Date and Time Types

Use `DATE` for business dates where time is not required:

- Loading date
- Unloading date
- Payment date
- Document expiry date

Use `TIMESTAMPTZ` for system events:

- Created at
- Updated at
- POD received timestamp
- Courier sent timestamp
- Audit event timestamp
- Payment reversal timestamp
- Bill generation timestamp
- Bill submission timestamp

---

# 39. Index Strategy

Important indexes should include:

### Trips

- `trip_number`
- `party_id`
- `vehicle_owner_id`
- `market_vehicle_id`
- `own_fleet_vehicle_id`
- `loading_date`
- `unloading_date`
- `status`
- `pod_status`

### Parties

- `name`
- `primary_mobile`
- `party_type`

### Vehicle Owners

- `name`
- `mobile`

### Market Vehicles

- `vehicle_number`
- `vehicle_owner_id`

### Own Fleet

- `vehicle_number`
- `state`

### Payments

- `payment_id`
- `payment_date`
- `type`
- `status`
- `party_id`
- `vehicle_owner_id`

### Bills

- `bill_number`
- `party_id`
- `status`
- `financial_year_id`
- `numbering_series_id`

### Audit

- `occurred_at`
- `actor_user_id`
- `entity_type`
- `entity_id`
- `module`
- `action`

Indexes should be verified against actual query patterns.

---

# 40. Search Indexes

Global Search should use appropriate database indexes.

For exact identifiers, B-tree indexes are appropriate.

For broader text search, PostgreSQL full-text search or an equivalent mechanism may be used.

Do not add a separate search engine unless actual scale or requirements justify it.

---

# 41. Unique Constraints

At minimum, enforce:

```text
users.mobile

trips.trip_number

payments.payment_id

market_vehicles.vehicle_number

own_fleet_vehicles.vehicle_number

(bill_id, version_number)
```

Bill numbering must also prevent duplicate bill numbers within the applicable Financial Year/numbering scope.

---

# 42. Check Constraints

Useful database checks include:

```text
amount > 0
version_number > 0
sequence > 0
financial_year.end_date > financial_year.start_date
credit remaining >= 0
```

Complex cross-table rules should remain in service-layer validation and transactions.

---

# 43. Payment Allocation Integrity

The system must ensure:

```text
SUM(active payment allocations)
=
payment amount
```

A payment must not be over-allocated.

Bulk/FIFO allocation must fully allocate the payment amount, with excess becoming party credit where applicable.

Reversal removes the active financial effect while preserving required historical information.

---

# 44. Credit Integrity

For party credit:

```text
remaining =
generated - utilized
```

If the remaining value is stored, it must be updated transactionally.

Credit cannot become negative.

---

# 45. Bill Payment Integrity

Bill payment status is derived from active payment allocations.

Conceptually:

```text
Active allocated amount >= bill amount
        ↓
PAID
```

Otherwise the bill remains:

```text
GENERATED
```

or:

```text
SUBMITTED
```

There is no Partially Paid status.

If a payment is reversed, bill payment status must recalculate.

---

# 46. Bill Cancellation Integrity

Cancellation must:

1. Set status to `CANCELLED`.
2. Require a cancellation reason.
3. Record who and when.
4. Return affected trips to unbilled state.
5. Preserve lightweight cancellation metadata.
6. Remove full active bill details/files according to the defined billing rules.
7. Prevent restoration.
8. Never reuse the cancelled bill number.

This should be executed transactionally.

---

# 47. Financial Year Relationships

Explicit Financial Year relationships should exist where required for:

- Bills
- Bill numbering series
- Financial reports
- Financial-year configuration

Payments and Trips may derive Financial Year from their business date if the implementation consistently handles Financial Year boundaries.

---

# 48. Bill Snapshot Strategy

A Bill Version must preserve enough structured information to reproduce that historical version.

Do not rely only on current Party or Trip data.

Example:

```text
Trip created
    ↓
Bill v1 generated
    ↓
Trip/master data changes
    ↓
Bill v1 remains reproducible
```

`bill_versions.structured_content` or an equivalent structured snapshot should preserve the resolved bill data needed for historical rendering.

---

# 49. Soft Delete Policy

Do not apply generic soft deletion to every table.

Use business-specific lifecycle behavior.

Examples:

- Payments → reverse.
- Bills → cancel.
- Own Fleet → Sold/Removed.
- Numbering series → deactivate.
- Users → deactivate.
- Documents → delete according to document rules.
- Masters → retain for historical relationships.

---

# 50. Historical Data Integrity

Historical records must retain their relevant relationships.

For example:

- Old Trips must retain their historical vehicle relationship.
- Old payments must retain their payment identity.
- Old bill versions must remain reproducible.
- Audit history must remain available.
- Financial-year records must remain accessible.

Current master values must not silently rewrite historical transactions.

---

# 51. Migration Strategy

Database changes must use versioned migrations.

Recommended logical order:

```text
001_users
002_financial_years
003_settings
004_parties
005_vehicle_owners
006_market_vehicles
007_own_fleet
008_trips
009_trip_destinations
010_trip_financial_tables
011_documents
012_payments
013_payment_allocations
014_credits
015_bill_templates
016_numbering_series
017_bills
018_bill_versions
019_audit
020_indexes_and_constraints
```

The exact migration names may change during implementation.

---

# 52. Seed Strategy

Development seed data may include:

- Owner
- Staff
- CA
- Sample Company
- Sample Market Party
- Sample Vehicle Owner
- Sample Market Vehicle
- Sample Own Fleet Vehicle
- Sample Trip
- Sample Payment
- Sample Bill
- Sample Bill Template

Production credentials must never be included in seed files.

---

# 53. Database Testing

Tests should verify:

- Foreign keys
- Unique constraints
- Payment allocation integrity
- Bill numbering
- Bill version uniqueness
- Financial Year boundaries
- Status constraints
- Credit calculations
- Historical relationships
- Transaction rollback behavior
- Reversal integrity

Critical business invariants should have automated tests.

---

# 54. Conceptual ERD

```text
USERS
 │
 ├───────────────┐
 ▼               ▼
PAYMENTS       AUDIT_EVENTS
 │
 ▼
PAYMENT_ALLOCATIONS
 │
 ├───────────────┐
 ▼               ▼
TRIPS            BILLS
 │                 │
 ├───────┐         ├──────────────┐
 ▼       ▼         ▼              ▼
PARTIES VEHICLES BILL_VERSIONS BILL_NUMBERING_SERIES
 │       │         │
 │       └──┐      ▼
 │          │  BILL_VERSION_TRIPS
 ▼          ▼
CREDITS    TRIPS
```

This is a conceptual relationship map, not a graphical ERD.

---

# 55. Implementation Boundary

This document defines the database structure but does not authorize inventing unresolved business rules.

If implementation reveals ambiguity:

```text
Identify ambiguity
      ↓
Resolve requirement
      ↓
Update documentation
      ↓
Update schema if required
      ↓
Implement
```

Do not silently choose business behavior inside the database layer.

---

# 56. Non-Negotiable Database Rules

1. PostgreSQL is the structured-data source of truth.
2. Money uses exact decimal types.
3. Payments are never physically deleted.
4. Payment IDs remain stable.
5. Payment allocations must reconcile to payment amounts.
6. Vehicle-owner overpayments do not create carried-forward vehicle-owner credit.
7. Bill statuses are exactly Generated, Submitted, Paid, Cancelled.
8. Bills have no Partially Paid status.
9. Bill corrections create versions.
10. Bill corrections do not consume new bill numbers.
11. Cancelled bill numbers are never reused.
12. Audit records cannot be modified or deleted through normal application APIs.
13. Historical Financial Year data remains accessible.
14. Market Vehicles do not have own-fleet status states.
15. Own Fleet remains separate from Market Vehicles.
16. Document metadata and file storage remain separate.
17. Structured bill data remains independent from generated PDFs.
18. Actual money movement exists only through Payment records.
19. Multi-record financial mutations use database transactions.
20. Foreign-key behavior must not accidentally destroy historical financial records.
