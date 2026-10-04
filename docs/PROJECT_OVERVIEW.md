# Shri Sanwariya Road Lines (SRL)
# Project Overview

## 1. Project Name

**Shri Sanwariya Road Lines (SRL) Internal Business Management Application**

Short reference:
**SRL Application**

---

# 2. Purpose

The SRL Application is an internal web-based business management system for Shri Sanwariya Road Lines.

The application is designed specifically around SRL's transportation business operations.

Its primary purpose is to provide one structured system for managing:

- Transport trips
- Market vehicle operations
- Own-fleet operations
- Parties and companies
- Vehicle owners
- Billing
- Actual business payments
- Financial reporting
- TDS-related information
- CA/tax-related access
- Business documents
- Historical business records
- Users and permissions

The application should replace fragmented operational record-keeping with a centralized, auditable system.

---

# 3. Business Context

SRL operates in two major transportation channels:

## 3.1 Tied-Up Companies / Vendorship

Companies provide transportation requirements to SRL.

SRL arranges vehicles and completes the transportation service.

Typical flow:

Company Requirement
    ↓
Vehicle Arrangement
    ↓
Trip
    ↓
Loading
    ↓
Transportation
    ↓
Unloading
    ↓
POD Received
    ↓
Billing
    ↓
Company Payment
    ↓
Settlement

Important characteristics:

- Companies do not provide trip advances.
- Billing is performed after the applicable trip is completed and POD is received.
- A company may pay a specific bill.
- A company may also make a bulk payment covering multiple outstanding receivables.
- Excess incoming payment can become company credit.
- Company billing configuration is maintained separately.

---

## 3.2 Market / Parties

Market customers are referred to as Parties.

A Party contacts SRL when transportation is required.

The rate is negotiated by phone.

SRL arranges a market vehicle and creates the Trip.

Typical flow:

Party Requirement
    ↓
Rate Negotiation
    ↓
Vehicle Arrangement
    ↓
Trip Creation
    ↓
Advance Payment
    ↓
Loading
    ↓
Transportation
    ↓
Unloading
    ↓
POD Received
    ↓
POD Sent
    ↓
Balance Payment
    ↓
Settlement

Important characteristics:

- Market trips may receive an advance.
- The actual advance is recorded through the Payment Module.
- POD is required as part of the operational/billing process.
- After POD is sent, the Party can be contacted regarding the balance.
- Excess incoming payment can become Party credit.
- Vehicle-owner payments are handled separately.

---

# 4. Own Fleet

SRL also owns its own vehicles.

Own Fleet vehicles are managed separately from Market Vehicles.

An Own Fleet Trip:

- Uses an SRL-owned vehicle.
- Has no vehicle-owner payable side.
- Can generate own-fleet expenses.
- Is settled when the Party-side receivable is fully accounted for.

Own-fleet expenses can include:

- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other

Actual payments for these expenses are recorded through the Payment Module.

---

# 5. Core Users

The system has three primary roles.

## Owner

The Owner has full system access.

The Owner is responsible for:
- Business administration
- Operations
- Payments
- Billing
- Billing configuration
- Financial reporting
- Own Fleet
- Documents
- Users
- Settings

---

## Staff

Staff handles day-to-day business operations.

Staff can:
- Manage trips
- Manage operational masters
- Manage own fleet operations
- Upload documents
- Create/edit payments
- Generate/edit bills

Staff cannot perform restricted administrative or destructive financial actions.

---

## CA

The CA is a financial/tax user.

The CA primarily needs access to:
- Payments
- Financial Reports
- TDS
- Financial-year records
- Bills
- Relevant Trips
- Supporting records
- CA/Tax/ITR workspace

CA access is read-only for the application's operational and financial records.

---

# 6. Major Application Areas

The application is organized into four major navigation groups.

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

# 7. Core Business Entities

The primary business entities are:

- User
- Party / Company
- Vehicle Owner
- Market Vehicle
- Own Fleet Vehicle
- Trip
- Trip Destination
- Trip Financial Record
- Trip Issue
- Bill
- Bill Version
- Bill Template
- Bill Numbering Series
- Payment
- Payment Allocation
- Credit
- Document
- Financial Year
- Audit Record

These entities form the core of the application's data model.

---

# 8. Fundamental System Relationships

The basic business relationship is:

Party / Company
    ↓
Trip
    ↓
Bill
    ↓
Payment Allocation
    ↓
Payment

For market vehicle operations:

Vehicle Owner
    ↓
Market Vehicle
    ↓
Trip
    ↓
Vehicle Owner Payable
    ↓
Payment

For own fleet:

Own Fleet Vehicle
    ↓
Trip
    ↓
Own Fleet Expenses
    ↓
Payment

The application must preserve these relationships without duplicating actual payment records.

---

# 9. Payment Architecture Principle

The most important financial architecture principle is:

> **The Payment Module is the single source of truth for actual money movement.**

Payments are the authoritative records for actual:

- Money received
- Money paid
- Other business receipts
- Other business payments
- Vehicle-owner payments
- Own-fleet expense payments

Trips and Bills may reference payment records.

They must not create independent copies of actual payment transactions.

---

# 10. Financial Reporting Principle

Financial Reports are generated exclusively from Payment Module records.

The Financial Reports module does not independently construct financial transactions from Trips or Bills.

The basic relationship is:

Payment Module
    ↓
Financial Reports

The application's payment-based P&L is:

**Net P&L = Active Incoming Payments − Active Outgoing Payments**

Reversed payments remain in historical records but do not contribute to financial totals.

The payment-based P&L is an operational business report and is not intended to replace formal statutory accounting.

---

# 11. Trip vs Payment vs Bill

These three concepts must remain distinct.

## Trip

Represents the transportation activity and related business obligations/calculations.

Examples:
- Freight
- Receivable
- Payable
- Charges
- Deductions
- TDS
- Settlement
- Trip-level P&L

---

## Payment

Represents actual money movement.

Examples:
- Party payment
- Company payment
- Vehicle-owner payment
- Diesel payment
- FASTag payment
- Other business payment
- Other business receipt

---

## Bill

Represents the billing document generated for eligible trips.

A Bill can reference:
- Trips
- Payment allocations
- Party/Company
- Billing configuration
- Bill template

But the Bill itself is not the source of truth for actual payment movement.

---

# 12. Market Vehicle vs Own Fleet Vehicle

These are separate concepts.

## Market Vehicle

A vehicle not owned by SRL.

Its master record contains:
- Vehicle Number
- Vehicle Owner
- Owner Mobile Number

Market Vehicles have **no separate status field**.

Their usage is determined from Trips.

---

## Own Fleet Vehicle

A vehicle owned by SRL.

Own Fleet management includes:
- Vehicle information
- Vehicle documents
- Document expiry
- Trip history
- Own-fleet expenses
- Financial summary

Operational state is derived from:
- Active Trip
- Maintenance state
- Permanent removal/sale

---

# 13. Trip Lifecycle

The general Trip lifecycle is:

Created
    ↓
Loading
    ↓
Travel
    ↓
Unloaded / Completed
    ↓
POD Received
    ↓
POD Sent
    ↓
Billing / Payment / Settlement
    ↓
Settled

A Trip can remain permanently accessible as historical business data.

Important distinction:

**Completed ≠ Settled**

A Trip may be completed operationally while financial obligations remain outstanding.

---

# 14. POD and Courier

POD is a physical transportation document.

The application supports:
- POD upload
- POD timestamp
- Multiple POD files
- LR information
- Invoice information
- Courier docket number
- Courier envelope file
- Courier sent timestamp

POD upload timestamp represents the POD received timestamp.

Courier information becomes relevant after POD is received.

---

# 15. Billing

A Trip becomes eligible for billing only after the applicable completion/POD requirements are satisfied.

Company billing supports:

- Individual bills
- Consolidated bills

The Party/Company's configured billing mode controls how billing is normally generated.

A Trip can belong to only one active bill.

Bills support versioning.

Example:

Bill Number:
`SRL/26-27/001`

Versions:
- V1
- V2
- V3

Editing creates a new version without changing the Bill Number.

---

# 16. Bill Statuses

The application uses exactly four Bill statuses:

- Generated
- Submitted
- Paid
- Cancelled

There is no separate Partially Paid status.

Paid status is derived from the applicable active Payment allocations.

---

# 17. Bill Numbering

Bill numbering resets every Financial Year.

Example:

FY 2026–27:
- SRL/26-27/001
- SRL/26-27/002

FY 2027–28:
- SRL/27-28/001
- SRL/27-28/002

Cancelled Bill numbers are not reused.

---

# 18. Bill Designer

The application includes a structured visual Bill Designer.

The designer supports:

- Automatic reconstruction from existing PDF/JPG/PNG bill formats
- Editable reconstructed elements
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
- Multi-page documents
- Element positioning
- Element resizing
- Formatting

The uploaded reference document is not used as a permanent static background for generated bills.

Generated bills are rendered from structured template data.

---

# 19. Documents

The application has a central Documents module.

Documents can belong to:

- Trips
- Parties / Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet Vehicles
- Payments
- Bills
- Other supported business records

The central Documents module provides access to files without duplicating the underlying business record.

---

# 20. Historical Records

The system is intended to preserve multi-year business history.

Core structured records should remain accessible historically, including:

- Trips
- Payments
- Bills
- Bill versions
- Parties
- Vehicle Owners
- Vehicles
- TDS information
- Financial records
- Audit records

File retention is governed separately by document-specific rules.

---

# 21. Search

The system includes Global Search across major business identifiers.

Searchable information includes:

- Trip Number
- Vehicle Number
- Party / Company Name
- Vehicle Owner Name
- Mobile Numbers
- Bill Number
- Payment ID
- LR Number
- Invoice Number
- Courier Docket Number
- Relevant document information

Results are grouped into:

- Trips
- Parties / Companies
- Vehicles
- Vehicle Owners
- Bills
- Payments
- Documents

---

# 22. Navigation Context

The application should preserve navigation context when users move between related records.

Example:

Payments
    ↓
Payment
    ↓
Trip
    ↓
Party

Returning should take the user back through the logical navigation path rather than unnecessarily returning to a generic list.

Where practical, preserve:
- Search state
- Filters
- Pagination
- Scroll state
- Previous list context

---

# 23. System Design Principles

The application should prioritize:

### Data Integrity
Business records must remain internally consistent.

### Financial Accuracy
Actual money movement must have one authoritative source.

### Auditability
Important financial and administrative actions must be traceable.

### Historical Preservation
Historical structured business data should remain accessible.

### Role-Based Access
Users must only be able to perform operations permitted by their role.

### Operational Simplicity
The system should support SRL's actual workflow without unnecessary ERP features.

### Structured Data
Important business information should be stored as structured fields rather than free-form text wherever future calculation, search, reporting, or billing depends on it.

### Modularity
Operations, Billing, Payments, Reporting, Documents, and Configuration should remain logically separated while maintaining their required relationships.

---

# 24. Application Boundary

The SRL Application is an internal business management system.

It is responsible for:
- Transport operations
- Business records
- Billing
- Payment records
- Payment-derived reports
- Documents
- User access
- Operational financial context

Formal statutory accounting and tax interpretation remain within the CA/tax workflow.

The application should provide the CA with the underlying records and reports required by the defined workflow without assuming or inventing statutory accounting rules that have not been specified.

---

# 25. Development Direction

The system should be developed in dependency order.

Recommended high-level sequence:

1. Project foundation
2. Authentication and roles
3. Master data
4. Trips
5. Documents
6. Payments
7. Bills
8. Bill Designer
9. Financial Reports
10. Dashboard
11. Global Search
12. Testing
13. Deployment

Detailed implementation order may be adjusted when technical dependencies require it, but business rules must remain unchanged unless explicitly approved.