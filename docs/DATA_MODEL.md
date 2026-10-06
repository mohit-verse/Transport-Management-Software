# Data Model

## 1. Purpose

This document defines the logical data model for the Shri Sanwariya Road Lines (SRL) application.

It describes:

- Core entities.
- Entity relationships.
- Required fields.
- Financial relationships.
- Status values.
- Document relationships.
- Billing relationships.
- Payment relationships.
- Audit relationships.

This document defines the logical model only. Database-specific implementation details such as SQL tables, indexes, ORM syntax, migrations, and database engine configuration belong to the implementation phase.

---

# 2. Core Entity Groups

The application data model is organized into the following groups.

## Operational

- User
- Trip
- Party / Company
- Vehicle Owner
- Market Vehicle
- Own Fleet Vehicle
- Destination
- Trip Issue

## Financial

- Payment
- Payment Allocation
- Credit Balance
- TDS Record
- Own Fleet Expense
- Other Business Payment
- Other Business Receipt

## Billing

- Bill
- Bill Version
- Billing Configuration
- Billing Numbering Series
- Billing Template

## Documents

- Document
- Document Metadata
- Bill PDF

## System

- Audit Log
- Financial Year
- System Settings

---

# 3. User

Represents an authenticated application user.

## Fields

- User ID
- Name
- Mobile Number
- Password Hash
- Role
- Account Status
- Created At
- Updated At
- Last Login At

## Role

Allowed initial roles:

- Owner
- Staff
- CA

## Account Status

At minimum:

- Active
- Inactive

Inactive users must not be able to authenticate or perform application actions.

---

# 4. Party / Company

A Party represents a customer/business entity from whom SRL receives money.

A Party can operate through either of the approved business channels:

- Market Party
- Company

## Fields

- Party ID
- Party / Company Name
- Primary Mobile Number
- Full Address
- City
- State
- PIN Code
- GSTIN
- Party Type
- Billing Address
- TDS Applicable
- Created At
- Updated At

## Party Type

Allowed values:

- Market Party
- Company

## Rules

- One Party Master has one billing address.
- One Party Master has one GSTIN.
- GSTIN is not displayed on the Party/Company list.
- TDS Applicable is not displayed on the Party/Company list.
- Party records can be created incompletely through quick-create workflows.
- Staff can create/edit Party Master fields.
- Owner has full access.
- CA cannot modify Party Master data.

---

# 5. Vehicle Owner

Represents a non-SRL vehicle provider used for market trips.

## Fields

- Vehicle Owner ID
- Vehicle Owner Name
- Mobile Number
- Created At
- Updated At

## Relationships

One Vehicle Owner can own multiple Market Vehicles.

A Vehicle Owner can be associated with multiple Trips.

A Vehicle Owner can receive multiple Payments.

## Rules

Vehicle Owner financial records do not generate a credit balance.

---

# 6. Market Vehicle

Represents a vehicle that is not owned by SRL.

## Fields

- Vehicle ID
- Vehicle Number
- Vehicle Owner ID
- Vehicle Owner Name/relationship
- Vehicle Owner Mobile Number/relationship
- Created At
- Updated At

## Relationships

- Belongs to one Vehicle Owner.
- Can be used by multiple Trips over time.

## Important Rule

Market Vehicles do **not** have a vehicle-status field.

There is no:

- Available
- In Trip
- Maintenance

status system for Market Vehicles.

The vehicle's trip history determines its historical usage.

---

# 7. Own Fleet Vehicle

Represents an SRL-owned vehicle.

SRL currently operates its own fleet separately from Market Vehicles.

## Fields

- Own Fleet Vehicle ID
- Vehicle Number
- Current State
- Created At
- Updated At

## Allowed States

- In Trip
- Available
- Under Maintenance
- Sold / Removed

## State Rules

### In Trip

Automatically applicable when an active own-fleet trip exists for the vehicle.

### Available

Applicable when:

- No active own-fleet trip exists.
- Vehicle is not under maintenance.

### Under Maintenance

Can be set by the Owner only when there is no active trip.

A vehicle under maintenance cannot be assigned to a new trip.

### Sold / Removed

Represents permanent departure from the active fleet.

Historical records must remain accessible.

---

# 8. Trip

Trip is the central operational entity.

A Trip represents one transport movement handled by SRL.

## Core Fields

- Trip ID
- Trip Number
- Trip Type
- Vehicle Relationship
- Trip Status
- Party / Company ID
- Vehicle Number
- Driver Mobile Number
- Vehicle Owner ID where applicable
- Own Fleet Vehicle ID where applicable
- Origin
- Origin City
- Origin State
- Loading Date
- Unloading Date
- Created By
- Created At
- Updated By
- Updated At

---

# 9. Trip Type

Allowed values:

- Market
- Company

## Market Trip

A Market Trip is associated with:

- Market Party
- Market Vehicle
- Vehicle Owner

The Party provides the transport requirement and negotiates the rate.

## Company Trip

A Company Trip is associated with:

- Company
- Market Vehicle or Own Fleet Vehicle

Company trips do not have company advances.

---

# 10. Vehicle Relationship

A Trip must identify whether the vehicle belongs to:

- Market
- Own Fleet

This relationship determines the financial structure of the trip.

## Market Vehicle Trip

Financial sides:

1. Party/Company Receivable
2. Vehicle Owner Payable

## Own Fleet Trip

Financial sides:

1. Party/Company Receivable
2. Own Fleet Expenses

There is no Vehicle Owner payable for an Own Fleet Trip.

---

# 11. Trip Status

The Trip lifecycle must support:

- Created / Active
- Completed
- Unsettled
- Settled
- Cancelled

The application may represent active operational states internally, but the user-facing trip lifecycle must preserve the distinction between:

`Completed != Settled`

## Completed

The vehicle has completed unloading.

## Settled

All applicable financial sides have been accounted for.

## Cancelled

The trip has been cancelled.

Cancelled trips remain historically accessible.

---

# 12. Destination

A Trip can have multiple destinations.

Each destination is stored as a structured entry rather than being stored only as plain text.

## Fields

- Destination ID
- Trip ID
- Destination
- City
- State
- Unloading Date
- Party-side Unloading Charge
- Vehicle-owner Unloading Charge where applicable
- Own-fleet Unloading Expense where applicable
- Sequence
- Created At
- Updated At

## Rules

- A trip may contain multiple destinations.
- Each destination can have its own unloading date.
- Party-side unloading charges can differ from vehicle-owner-side charges.
- Own-fleet unloading expenses are attached to the destination.
- Destination order must be preserved.
- Destination identity is persistent. Existing destinations are edited in place. Removal is rejected when linked financial records exist.

---

# 13. Party / Company Receivable

The receivable is the amount owed to SRL by the Party/Company.

## Components

- Freight
- Advance / payments accounted through Payment Module
- Balance
- Unloading Charges
- Detention
- Other Charges
- Shortage/Damage Deductions
- TDS
- Total Receivable
- Amount Accounted / Received
- Outstanding

## Important Rule

Actual money received is stored only through the Payment Module.

Trip financial data must not create duplicate payment records.

The Trip stores the obligation/calculation context and references actual Payment records.

---

# 14. Vehicle Owner Payable

Applicable only to Market Vehicle Trips.

## Components

- Vehicle Owner
- Base Freight
- Advance / payment allocations
- Balance Payable
- Detention
- Unloading Charges
- Other Charges
- Shortage/Damage Deductions
- Total Payable
- Amount Paid
- Outstanding Payable

## Important Rule

Actual money paid to the Vehicle Owner is stored only through the Payment Module.

The Trip stores payable calculations and references actual outgoing Payments.

Vehicle Owner overpayments do not create a Vehicle Owner credit balance.

---

# 15. Own Fleet Expenses

Applicable only to Own Fleet Trips.

Own Fleet Expenses are actual business expenses associated with the trip.

## Expense Categories

### Diesel

Multiple entries are allowed.

Each entry contains:

- Amount
- Date

### FASTag

Multiple entries are allowed.

Each entry contains:

- Amount
- Date

### Border

Contains:

- Amount
- Date
- Remark

Date defaults to the current date but can be edited.

### Loading

Optional.

One loading expense amount can be associated with the trip.

### Unloading

Multiple entries are allowed.

Each entry is associated with a destination.

### Other

Multiple entries are allowed.

Each entry contains:

- Charge Name
- Amount
- Reason / Remark

No additional Own Fleet expense categories should be introduced without approval.

---

# 16. Trip P&L

Trip P&L is a trip-level calculation.

## Market Trip

Conceptually:

`Trip P&L = Net Party Receivable - Net Vehicle Owner Payable`

## Own Fleet Trip

Conceptually:

`Trip P&L = Net Party Receivable - Own Fleet Expenses`

Trip P&L is separate from the Payment Module's overall business P&L.

The Payment Module's overall P&L is based on actual business payments.

---

# 17. Payment

Payment represents an actual movement of money.

This is the authoritative entity for actual incoming and outgoing business payments.

## Core Fields

- Payment ID
- Payment Date
- Payment Type
- Entity
- Category
- Amount
- Payment Mode
- Status
- Created By
- Created At
- Last Edited By
- Last Edited At

## Payment Type

- Incoming
- Outgoing

## Payment Mode

- UPI
- Bank Transfer
- Cash

---

# 18. Payment Categories

## Incoming

- Company Payment
- Market Party Payment
- Other Business Receipt

## Outgoing

- Vehicle Owner Payment
- Own Fleet Expense
- Other Business Payment

The category identifies the business purpose of the payment.

---

# 19. Payment Status

Allowed values:

- Active
- Reversed

Only Active payments contribute to financial totals.

Reversed payments remain available for historical/audit purposes.

---

# 20. Payment Allocation

A Payment Allocation connects an actual Payment to the financial obligation it satisfies.

## Possible Relationships

An incoming payment can be allocated to:

- Specific Bill
- Specific Trip
- Bulk/FIFO receivables

An outgoing payment can be linked to the applicable:

- Vehicle Owner payable
- Own Fleet Expense
- Other Business Payment category

## Fields

- Allocation ID
- Payment ID
- Allocation Type
- Trip ID where applicable
- Bill ID where applicable
- Allocated Amount
- Allocation Date
- FIFO Reference where applicable

---

# 21. Payment Allocation Rules

A completed payment cannot remain partially allocated.

The complete payment amount must be accounted for.

For Party/Company payments:

`Payment Amount = Allocated Receivables + Generated Credit`

For other standalone payment/receipt categories:

The payment is fully assigned to its category.

Bulk payments use FIFO allocation.

Excess incoming amounts become Party/Company credit where applicable.

---

# 22. Credit Balance

Credit represents excess incoming money belonging to a Party/Company after receivables have been satisfied.

## Fields

- Credit ID
- Party ID
- Source Payment ID
- Generated Amount
- Utilized Amount
- Remaining Amount
- Generated Date
- Status

## Rules

- Company credit is allowed.
- Market Party credit is allowed.
- Vehicle Owner credit is not allowed.
- Credit can be used against future Party/Company receivables.
- FIFO rules apply to utilization where applicable.

---

# 23. TDS

TDS is a financial adjustment associated with Party/Company receivables.

## Data

TDS must retain:

- Trip reference
- Party/Company reference
- TDS amount
- Financial Year
- Relevant date
- Related payment references where applicable
- Status/position

The actual TDS amount is entered through the trip/financial workflow.

TDS is not itself a Payment record.

---

# 24. Bill

A Bill represents a billing document generated for a Company.

Bills can be:

- Individual
- Consolidated

## Core Fields

- Bill ID
- Bill Number
- Company/Party ID
- Bill Date
- Billing Mode
- Current Version ID
- Status
- Created By
- Created At
- Updated At

---

# 25. Bill Status

Allowed values:

- Generated
- Submitted
- Paid
- Cancelled

There is no:

- Draft
- Partially Paid

status.

## Paid

A Bill becomes Paid when its full bill amount is accounted for through active Payment allocations.

If a payment is reversed, the Bill status is recalculated.

---

# 26. Bill Version

A Bill can have multiple versions.

## Fields

- Bill Version ID
- Bill ID
- Version Number
- Version Status
- Template Reference
- Generated Document Reference
- Created By
- Created At
- Change Reason where applicable

## Rules

- Bill number remains the same across versions.
- Version numbers increment: v1, v2, v3...
- Latest version is current.
- Previous versions are read-only.
- A correction creates a new version.
- A new Bill Number is not generated for a correction.
- A new Bill Number is created only for a new Bill.

---

# 27. Bill and Trip Relationship

A Trip can belong to at most one active Bill.

A Bill can contain:

- One Trip for Individual Billing.
- Multiple Trips for Consolidated Billing.

## Eligibility

A Trip must be:

- Completed.
- POD received.
- Unbilled.

before it can be included in a Company Bill.

---

# 28. Bill Cancellation Relationship

When a Bill is cancelled:

- Bill status becomes Cancelled.
- Cancellation reason is mandatory.
- Cancelled by and cancellation timestamp are recorded.
- Associated Trips return to Unbilled.
- Full bill details/document files are removed from active storage.
- Lightweight cancellation metadata remains permanently.
- Cancelled Bills cannot be restored.

A new Bill can be generated from the returned trips.

---

# 29. Billing Configuration

Billing configuration belongs to the Company/Party.

## Configuration

- Billing Mode
- Billing Template
- Numbering Series
- Required Billing Fields
- TDS Treatment

## Billing Mode

- Individual
- Consolidated

One Company has one configured billing mode at a time.

The configuration can be changed later.

Existing Bills remain unchanged.

Future Bills use the new configuration.

---

# 30. Billing Numbering Series

A Company can have multiple numbering series.

## Fields

- Series ID
- Party/Company ID
- Series Name/Identifier
- Prefix
- Financial Year
- Current Sequence
- Active/Inactive
- Created At
- Updated At

## Rules

The user selects the required numbering series when generating a Bill.

There is no default numbering series.

Numbering resets every Financial Year.

Example:

`SRL/26-27/001`

`SRL/27-28/001`

Cancelled Bill numbers are never reused.

---

# 31. Billing Template

A Billing Template is the structured representation used to render a Bill.

Templates can contain:

- Text
- Tables
- Borders
- Lines
- Dynamic Fields
- Images
- Logos
- Signature
- Stamp
- Page Header
- Page Footer
- Spacing
- Alignment
- Repeatable Trip Rows
- Calculated Fields
- Page Breaks

A template must support both Individual and Consolidated billing where configured.

---

# 32. Dynamic Billing Fields

The Bill Designer must be able to reference structured data from:

- Trip
- Party/Company
- Vehicle Owner where applicable
- Vehicle
- Destination
- Financial information
- Billing information
- Other approved master data

The system should not hard-code the Bill Designer to only a small predefined list of fields.

Dynamic fields should be organized according to their source entity.

---

# 33. Document

Document represents an uploaded business file.

## Fields

- Document ID
- Document Type
- Filename
- File Reference
- File Size
- Uploaded By
- Uploaded At
- Related Entity
- Related Entity ID
- Active/Inactive state where required
- Metadata

## Rules

Multiple files can exist for the same document type.

---

# 34. Trip Documents

Trip documents can include:

- POD
- Courier Envelope
- Issue Documents
- Payment Attachments where linked
- Other Trip Attachments

A Trip can contain multiple files of the same document type.

---

# 35. Courier Information

Courier information belongs to the Trip's POD/courier workflow.

## Fields

- Courier Docket Number
- Courier Envelope File
- Courier Sent Status
- Courier Sent Date/Time

Courier information becomes relevant after POD is received.

---

# 36. Trip Issue

Represents an operational issue associated with a Trip.

## Issue Types

At minimum:

- Shortage
- Damage

## Fields

- Issue ID
- Trip ID
- Issue Type
- Issue Details
- Status
- Resolution/Closure
- Supporting Documents
- Created By
- Created At
- Updated By
- Updated At

## Important Rule

An Issue is not automatically a financial deduction.

A separate financial adjustment must exist before an amount is deducted.

---

# 37. Other Business Payment

Represents an outgoing payment that is not directly associated with Vehicle Owner payable or Own Fleet trip expense categories.

## Fields

- Payment ID
- Category/Name
- Amount
- Date
- Payment Mode
- Mandatory Remark
- Optional Attachment
- Status
- Created By
- Created At

Other Business Payments reduce the Payment Module's overall business P&L.

---

# 38. Other Business Receipt

Represents an incoming receipt that is not a Company or Market Party payment.

## Fields

- Receipt/Payment ID
- Category/Name
- Amount
- Date
- Payment Mode
- Mandatory Remark
- Optional Attachment
- Status
- Created By
- Created At

Other Business Receipts increase the Payment Module's overall business P&L.

---

# 39. Financial Year

Financial Year is a system-level financial partition used for reporting and numbering.

It must be associated with:

- Payments
- Bills
- TDS
- Financial reports
- Bill numbering

Financial-year records must remain historically accessible.

Bill numbering resets at the beginning of each Financial Year.

---

# 40. Audit Log

Audit Log records significant user actions.

## Fields

- Audit ID
- User ID
- User Role
- Action
- Entity Type
- Entity ID
- Timestamp
- Previous Value where applicable
- New Value where applicable
- Reason where applicable

## Important Actions

Audit coverage must include:

- Record creation.
- Record editing.
- Payment allocation.
- FIFO allocation.
- Payment reallocation.
- Payment reversal.
- Bill generation.
- Bill version creation.
- Bill cancellation.
- Billing configuration changes.
- TDS-related changes.
- Important trip changes.

Payment audit history must remain associated with the Payment Module.

---

# 41. Core Relationships

The primary logical relationships are:

```text
Party / Company
    │
    ├── Trips
    │      │
    │      ├── Destinations
    │      ├── POD / Documents
    │      ├── Issues
    │      ├── Bills
    │      └── Financial Calculations
    │
    ├── Bills
    │      └── Bill Versions
    │
    ├── Payments
    │      └── Payment Allocations
    │
    └── Credit Balance


Vehicle Owner
    │
    ├── Market Vehicles
    │
    ├── Trips
    │
    └── Outgoing Payments


Market Vehicle
    │
    └── Trips


Own Fleet Vehicle
    │
    ├── Trips
    └── Fleet Documents


Trip
    ├── Party / Company
    ├── Market Vehicle OR Own Fleet Vehicle
    ├── Vehicle Owner where applicable
    ├── Destinations
    ├── Receivable
    ├── Vehicle Owner Payable where applicable
    ├── Own Fleet Expenses where applicable
    ├── POD / Courier
    ├── Issues
    ├── Bill
    ├── Payments
    ├── TDS
    ├── Documents
    └── Audit History


Payment
    └── Payment Allocations
            ├── Trip
            ├── Bill
            └── Credit


Bill
    ├── Company
    ├── Trips
    ├── Bill Versions
    ├── Billing Template
    ├── Numbering Series
    └── Payments

# 42. Financial Data Authority

The following distinction is mandatory.

## Trip

Trip stores:

- Financial obligations.
- Receivable calculations.
- Payable calculations.
- Deductions.
- TDS.
- Trip-level P&L calculation.
- Settlement state.

## Payment Module

Payment stores:

- Actual incoming money.
- Actual outgoing money.
- Payment date.
- Payment mode.
- Payment status.
- Payment allocation.
- FIFO allocation.
- Credit generated from excess incoming payments.

The Trip must never become a second payment ledger.

---

# 43. Financial Report Authority

Financial Reports are derived from Payment Module records.

Overall business P&L is:

`Active Incoming Payments - Active Outgoing Payments`

Reversed Payments are excluded.

Trip-level financial calculations and settlement information may be displayed within Trip and related operational pages, but they must not replace the Payment Module as the source for business financial reporting.

---

# 44. Historical Data Retention

The following structured records must remain accessible indefinitely unless a future retention policy is explicitly approved:

- Trips
- Payments
- Payment Allocations
- Bills
- Bill versions
- Party/Company records
- Vehicle Owner records
- Market Vehicle records
- Own Fleet historical records
- TDS records
- Financial-year records
- Audit history

Physical documents may be deleted by authorized users according to document-storage rules, but critical structured business records must remain intact.

---

# 45. Data Integrity Rules

The system must enforce the following:

1. A Market Vehicle belongs to a Vehicle Owner.
2. An Own Fleet Vehicle must never create a Vehicle Owner payable.
3. A Market Vehicle must not be treated as an Own Fleet Vehicle.
4. A Trip cannot belong to multiple active Bills.
5. A Bill cannot include an ineligible Trip.
6. A cancelled Bill releases its Trips back to Unbilled.
7. A Bill version does not create a new Bill Number.
8. A corrected Bill creates a new version.
9. Bill numbering never reuses cancelled numbers.
10. Actual payments exist only in the Payment Module.
11. Payment reversal recalculates affected financial positions.
12. Payment reallocation recalculates affected financial positions.
13. Reversed payments do not contribute to financial reports.
14. Vehicle Owner overpayment does not create Vehicle Owner credit.
15. Party/Company excess incoming payment creates credit.
16. Credit is available for future Party/Company receivables.
17. TDS is not itself a Payment record.
18. Operational Issues do not automatically create deductions.
19. Own Fleet expenses do not create Vehicle Owner payable.
20. Own Fleet historical records remain accessible after a vehicle is Sold/Removed.

---

# 46. Implementation Principle

The final database schema must preserve these logical relationships without introducing duplicate sources of truth.

In particular:

- Payment data must have one authoritative source.
- Billing data must preserve versions.
- Master records must be reusable across trips.
- Historical records must remain queryable.
- Financial calculations must be deterministic from their underlying records.
- Audit information must identify who performed significant changes.
- Deletion must not silently destroy financial history.