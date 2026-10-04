# Shri Sanwariya Road Lines (SRL) — Codex Project Instructions

## 1. Project Identity

Project: Shri Sanwariya Road Lines (SRL) Internal Business Management Application

SRL is a transport business that operates as:
- A transport broker using market vehicles
- An owner/operator of its own fleet
- A provider of transportation services to tied-up companies
- A provider of transportation services to market parties

This application is an internal business system for SRL.

The system must support:
- Daily transport operations
- Trip management
- Party/company management
- Vehicle owner management
- Market vehicle management
- Own fleet management
- Billing
- Actual payment recording
- Financial reporting
- TDS-related records
- CA/tax workflows
- Document management
- Historical business records

---

# 2. CRITICAL DEVELOPMENT PRINCIPLE

The documentation in `/docs` is the source of truth for the application's business rules.

Before implementing or modifying functionality:

1. Read the relevant documentation.
2. Follow the documented workflow exactly.
3. Do not invent business rules.
4. Do not silently change an existing business rule.
5. Do not duplicate financial records.
6. Do not introduce functionality that has not been requested or documented.
7. If two documented requirements conflict, stop and identify the conflict rather than choosing an arbitrary interpretation.
8. If a required behavior has not been defined, ask for clarification before implementing it when the missing decision materially affects business logic or data integrity.

---

# 3. SOURCE-OF-TRUTH RULES

These rules are fundamental and must not be violated.

## 3.1 Payment Module

The Payment Module is the single source of truth for actual money movement.

Actual incoming and outgoing business payments must be recorded only through the Payment Module.

Do not create duplicate payment records inside:
- Trips
- Bills
- Party/Company records
- Vehicle Owner records
- Own Fleet records
- Financial Reports

Those modules may display or reference payment information, but the actual payment record belongs to the Payment Module.

---

## 3.2 Financial Reports

Financial Reports are generated exclusively from Payment Module records.

Financial Reports must not independently create financial transaction records from:
- Trips
- Bills
- Party/Company records
- Vehicle Owner records
- Own Fleet records

Trips and Bills may provide operational context and links.

The payment-based financial report architecture is:

Payment Module
    ↓
Financial Reports
    ↓
CA / Tax / ITR workspace

For the application's payment-based P&L:

Net P&L = Active Incoming Payments - Active Outgoing Payments

Reversed payments do not contribute to financial totals.

The application's payment-based P&L is not a statutory accounting statement.

---

## 3.3 Trips

A Trip records operational information and business obligations/calculations.

A Trip does not become the source of truth for actual money movement.

Trip financial calculations may include:
- Receivables
- Payables
- Charges
- Deductions
- TDS
- Settlement
- Trip-level P&L

These calculations must not be confused with the Payment Module's actual money movement.

---

## 3.4 Bills

Bills are billing documents associated with eligible Trips.

Bills do not replace Payment records.

A bill can reference Payment allocations, but actual payment records remain in the Payment Module.

---

# 4. USER ROLES

The application has exactly three primary roles:

## Owner

Full access.

The Owner can:
- Manage all operations
- Manage Trips
- Manage Masters
- Manage Payments
- Reverse Payments
- Reallocate Payments
- Manage Bills
- Manage Billing Configuration
- Manage Bill Templates
- Manage Numbering Series
- Manage Own Fleet
- Manage Documents
- Manage Users and Roles
- Manage Settings
- Access Financial Reports
- Access CA/Tax/ITR functionality

---

## Staff

Operational and billing user.

Staff can:
- Create/edit Trips
- Manage operational records
- Create/edit Party/Company records
- Create/edit Vehicle Owner records
- Create/edit Market Vehicle records
- Manage Own Fleet operations
- Upload documents
- Create/edit Payments
- Generate/edit Bills
- Use existing billing configuration

Staff cannot:
- Reverse Payments
- Delete Payments
- Reallocate Payments
- Create FIFO bulk/unallocated payment allocations
- Modify Billing Configuration
- Manage Users/Roles
- Modify system Settings
- Perform CA/ITR administration

Staff cannot replace or delete uploaded documents.

---

## CA

Financial/tax user.

CA can:
- View Payments
- View Bills
- View financial reports
- View TDS records
- View relevant Trips
- Review financial-year records
- Access CA/Tax/ITR workspace
- Export permitted financial/supporting records

CA cannot:
- Modify Payments
- Reverse Payments
- Modify Trips
- Modify Bills
- Modify Masters
- Modify Billing Configuration
- Manage Documents
- Manage Users/Roles
- Modify system Settings

---

# 5. AUTHENTICATION

Authentication method:

**Mobile Number + Password**

Security requirements:
- Passwords must never be stored in plaintext.
- Use a secure password hashing algorithm such as Argon2id or bcrypt.
- Use HTTPS in deployed environments.
- Use secure session/token handling.
- Rate-limit authentication attempts.
- Throttle repeated failed login attempts.
- Enforce authorization on the backend, not only in the frontend.
- Owner controls user activation/deactivation.
- Provide password recovery/reset functionality.
- Record important security/account events in audit history.

---

# 6. APPLICATION MODULES

## OPERATIONS

- Dashboard
- Trips
- Parties / Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet

## FINANCE

- Payments
- Bills
- Financials / Reports

## DOCUMENTS

- Documents

## CONFIGURATION

- Bill Designer
- Users & Roles
- Settings

---

# 7. MARKET VEHICLES

Market Vehicles are vehicles not owned by SRL.

A Market Vehicle belongs to a Vehicle Owner.

Market Vehicle master information includes:
- Vehicle Number
- Vehicle Owner
- Owner Mobile Number

Market Vehicles have **no separate status field**.

Whether a market vehicle is involved in a current trip is determined through Trip records.

Market Vehicles must not be mixed with Own Fleet vehicles.

---

# 8. OWN FLEET

SRL owns its own fleet.

Own Fleet vehicles are managed separately from Market Vehicles.

Own Fleet vehicle operational state:

### In Trip
Automatically derived when the vehicle has an active Own Fleet Trip.

### Available
Vehicle has no active trip and is not under maintenance.

### Under Maintenance
Owner may mark the vehicle for maintenance only when it has no active trip.

A vehicle under maintenance cannot be assigned to a new Own Fleet Trip.

### Sold / Removed
Used when the vehicle permanently leaves the own fleet.

The vehicle record must not be deleted merely because it was sold/removed.

Historical Trips, Payments, Expenses, Documents and related records must remain accessible.

---

# 9. TRIP VEHICLE RELATIONSHIP

A Trip can use either:

- Market Vehicle
OR
- Own Fleet Vehicle

Never both simultaneously.

Market Trip:
- References Market Vehicle
- References Vehicle Owner

Own Fleet Trip:
- References Own Fleet Vehicle
- Has no vehicle-owner financial side

---

# 10. TRIP SETTLEMENT

Market Trip settlement requires:

Party-side settlement
AND
Vehicle-owner-side settlement.

Own Fleet Trip settlement requires:

Party-side settlement.

Completed and Settled are different states.

A trip may be Completed but still Unsettled.

---

# 11. PAYMENT RULES

Payment types:

### Incoming
- Company Payment
- Market Party Payment
- Other Business Receipt

### Outgoing
- Vehicle Owner Payment
- Own Fleet Expense
- Other Business Payment

Payment modes:
- UPI
- Bank Transfer
- Cash

Payment ID is automatically generated.

Payment date defaults to today but can be edited.

---

## Incoming Allocation

Incoming Company/Market Party payments can be:

- Specific Bill
- Specific Trip
- Bulk / FIFO

Completed payments cannot remain partially allocated.

The full payment amount must be accounted for.

For Company/Market Party payments:

Allocated amount + applicable Credit = Payment amount.

Excess payment becomes Credit.

Vehicle Owners do not receive a credit balance.

---

## Payment Reversal

Payments cannot be permanently deleted.

Owner can reverse a Payment.

Reversal requires:
- Reversal reason
- Reversed by
- Reversal date/time

Reversed Payment remains in history.

Its allocations and related financial calculations must be recalculated.

A reversed Payment cannot be restored.

A new Payment must be created if money is subsequently received/paid again.

---

# 12. BILL STATUSES

Bills have exactly four statuses:

- Generated
- Submitted
- Paid
- Cancelled

There is no Partially Paid status.

### Generated
Bill has been generated.

### Submitted
Bill has been submitted/sent to the Party/Company.

### Paid
The bill's full amount has been accounted for through active Payment allocations.

### Cancelled
Bill has been cancelled according to the cancellation workflow.

Paid status is system-derived from active Payment allocations.

---

# 13. BILL NUMBERING

Bill numbering resets every Financial Year.

Example:

FY 2026–27:
- SRL/26-27/001
- SRL/26-27/002

FY 2027–28:
- SRL/27-28/001
- SRL/27-28/002

Cancelled numbers are never reused.

Editing a bill creates a new version of the same Bill Number.

Editing does not generate a new Bill Number.

---

# 14. BILL VERSIONING

Example:

Bill:
- V1
- V2
- V3

Only the latest version is current.

Previous versions are read-only.

All versions belong to the same Bill Number.

---

# 15. BILL CANCELLATION

Cancellation requires a reason.

When a bill is cancelled:

- Status becomes Cancelled.
- Linked trips return to Unbilled.
- Active bill details/PDF files are removed from active storage.
- Lightweight cancellation metadata is retained.
- Cancelled bill cannot be restored.
- Trips can subsequently be billed through a new bill-generation process.

---

# 16. DOCUMENTS

Documents remain linked to their original business record.

Supported relationships include:
- Trips
- Party/Company
- Vehicle Owner
- Market Vehicle
- Own Fleet Vehicle
- Payments
- Bills
- Other supported business records

The central Documents module is an index/access layer.

Do not duplicate business records merely to support document access.

Owner:
- View
- Upload
- Replace
- Delete

Staff:
- View
- Upload

CA:
- View where permitted

---

# 17. BILL DESIGNER

The Bill Designer is a structured, editable document editor.

It supports:
- Automatic reconstruction from PDF/JPG/PNG
- Editable reconstructed elements
- Manual correction after reconstruction
- Text
- Tables
- Borders
- Lines
- Images
- Logo
- Signature
- Stamp
- Headers
- Footers
- Dynamic fields
- Calculated fields
- Repeatable rows
- Repeatable sections
- Page breaks
- Multi-page templates
- Positioning
- Resizing
- Formatting

Do not use an uploaded bill image/PDF as a permanent static background for generated bills.

Generated bills must be rendered from structured template data.

---

# 18. DYNAMIC BILL FIELDS

Dynamic fields are organized by source:

- Party / Company
- Trip
- Vehicle
- Vehicle Owner
- Journey / Destinations
- Receivables
- Vehicle Owner Payables
- Own Fleet Expenses
- POD / LR / Invoice
- Issues
- Billing
- Payment
- System / Bill Information
- Calculated Fields

Dynamic fields must be searchable.

---

# 19. REPEATABLE BILL DATA

The Bill Designer supports Repeatable Row / Repeatable Section.

For consolidated bills, trip rows can repeat for every selected Trip.

Destination-level repeatable sections are also supported.

Example:

Trip No. | LR No. | Date | From | To | Vehicle No. | Freight

The generated document must render the correct number of rows/sections based on the underlying data.

---

# 20. AUDITABILITY

Important business operations must be auditable.

Audit records should capture, where applicable:
- Who performed the action
- Date/time
- Action
- Previous value
- New value

Payment audit must cover:
- Creation
- Editing
- Allocation changes
- FIFO allocation
- Reallocation
- Reversal
- Status changes

Do not allow ordinary users to silently modify or erase audit history.

---

# 21. HISTORICAL RECORDS

Core structured records are retained indefinitely.

This includes:
- Trips
- Payments
- Bills
- Bill versions
- Parties
- Vehicle Owners
- Vehicles
- TDS records
- Financial records
- Audit records

File retention follows the specific document rules defined in the documentation.

---

# 22. GLOBAL SEARCH

Global Search must support major business identifiers including:

- Trip Number
- Vehicle Number
- Party/Company Name
- Vehicle Owner Name
- Mobile Number
- Bill Number
- Payment ID
- LR Number
- Invoice Number
- Courier Docket Number
- Relevant document information

Results should be categorized:

- Trips
- Parties / Companies
- Vehicles
- Vehicle Owners
- Bills
- Payments
- Documents

Opening a result must navigate to the original source record.

---

# 23. NAVIGATION CONTEXT

When navigating between related records, preserve the user's previous context where practical.

Example:

Payments
→ Payment
→ Trip
→ Party

Back should return through the logical navigation path.

Where practical, preserve:
- Search
- Filters
- Pagination
- Scroll position
- Previous list context

Global Search results should also preserve the search context when navigating back.

---

# 24. DEVELOPMENT DISCIPLINE

Codex must not:

- Invent missing business rules.
- Change locked business logic without explicit approval.
- Duplicate actual payment records.
- Create independent financial ledgers outside the Payment Module.
- Add arbitrary ERP features.
- Add unrequested statuses.
- Delete historical structured business records.
- Bypass backend authorization.
- Treat frontend restrictions as sufficient security.
- Replace structured bill templates with static images.
- Modify established UI behavior without explicit instruction.
- Remove existing functionality while implementing a new feature.

When a requirement is ambiguous and materially affects:
- Data integrity
- Financial calculations
- Permissions
- Security
- Workflow
- Database relationships

stop and request clarification.

---

# 25. DOCUMENTATION HIERARCHY

Before implementing a feature, consult the relevant documentation.

Recommended hierarchy:

1. `AGENTS.md`
2. `PROJECT_OVERVIEW.md`
3. `BUSINESS_REQUIREMENTS.md`
4. `FUNCTIONAL_REQUIREMENTS.md`
5. `ROLES_AND_PERMISSIONS.md`
6. `DATA_MODEL.md`
7. Module-specific architecture/specification
8. `API_SPECIFICATION.md`
9. `UI_UX_SPECIFICATION.md`
10. `DEVELOPMENT_RULES.md`

The more specific document governs the detailed implementation, provided it does not contradict higher-level locked business rules.

---

# 26. IMPLEMENTATION PRINCIPLE

Build the application incrementally.

Do not implement the entire application in one uncontrolled change.

Each implementation phase should:
1. Read relevant documentation.
2. Inspect existing code.
3. Identify dependencies.
4. Implement the smallest coherent unit.
5. Run validation/tests.
6. Check for regressions.
7. Update documentation when an explicitly approved requirement changes.
8. Preserve existing functionality.

Never silently reinterpret requirements during implementation.