# Shri Sanwariya Road Lines (SRL)
# Business Requirements

## 1. Purpose

This document defines the business rules and operational workflows of the Shri Sanwariya Road Lines (SRL) internal application.

These requirements describe how the SRL business operates and how the software must represent that operation.

This document is a business-rules source of truth.

Implementation details such as database technology, API design, frontend framework, and infrastructure are outside the scope of this document.

---

# 2. Business Model

SRL operates transportation services through three operational relationships:

1. Tied-up Companies / Vendorship
2. Market Parties
3. Own Fleet

The first two represent customer-side transportation business.

Own Fleet represents transportation performed using vehicles owned by SRL.

---

# 3. Tied-Up Company / Vendorship Workflow

A Company provides transportation requirements to SRL.

SRL arranges a vehicle and performs the transportation.

General workflow:

Company Requirement
    ↓
Vehicle Arrangement
    ↓
Trip Creation
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
Payment
    ↓
Settlement

## Company-specific rules

- Companies do not provide trip advances.
- A Company trip creates a receivable obligation.
- Billing is allowed only after the applicable Trip is completed and POD has been received.
- User manually selects eligible Trips for billing.
- A Trip can belong to only one active Bill.
- A Company may pay a specific Bill.
- A Company may make a bulk payment covering multiple outstanding receivables.
- Excess incoming payment becomes Company Credit.
- Company Credit can be applied to future receivables using the defined allocation/FIFO rules.
- TDS may apply according to the Party/Company configuration and Trip information.
- Company billing configuration is maintained separately from basic Party Master information.

---

# 4. Market / Party Workflow

Market customers are referred to as Parties.

A Party contacts SRL for a transportation requirement.

The rate is negotiated by phone.

General workflow:

Party Requirement
    ↓
Rate Negotiation
    ↓
Vehicle Arrangement
    ↓
Trip Creation
    ↓
Advance
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

## Market Trip rules

- Rate is negotiated before/at Trip creation.
- A market Trip requires a Market Vehicle.
- The Market Vehicle is associated with a Vehicle Owner.
- Trip creation requires Vehicle Number and Driver Mobile Number.
- Party may provide an advance.
- The actual advance must be recorded through the Payment Module.
- POD must be received as part of the operational workflow.
- After POD is sent, SRL may contact the Party regarding the balance.
- Party-side receivable may include charges, deductions and TDS.
- Excess incoming payment becomes Party Credit.
- Vehicle-owner payable is handled independently from Party receivable.

---

# 5. Own Fleet Workflow

SRL owns its own vehicles.

Own Fleet vehicles are separate from Market Vehicles.

General workflow:

Own Fleet Vehicle
    ↓
Own Fleet Trip
    ↓
Loading
    ↓
Transportation
    ↓
Unloading
    ↓
POD
    ↓
Party Settlement
    ↓
Trip Settled

## Own Fleet rules

- Own Fleet Trips do not have a Vehicle Owner payable side.
- Party-side receivable is still calculated.
- The Trip becomes Settled when the Party-side receivable is fully accounted for.
- Own Fleet expenses are associated with the Trip.
- Actual payments for Own Fleet expenses are recorded through the Payment Module.
- Own Fleet expenses may be entered after the Trip has become Settled.
- Adding a post-settlement Own Fleet expense requires a warning.
- Adding the expense does not change the Trip back from Settled.
- Trip-level P&L recalculates after a new expense is added.

---

# 6. Party / Company Master

A Party/Company record contains:

- Party / Company Name
- Primary Mobile Number
- Full Address
- City
- State
- PIN Code
- GSTIN
- Party Type
  - Market Party
  - Company
- Billing Address
- TDS Applicable
  - Yes
  - No

The Party Master does not include:
- PAN
- Email
- Alternate mobile
- Contact person
- Other unapproved master fields

Quick creation from a Trip is allowed.

Quick-created records may initially be incomplete and can be completed later.

---

# 7. Party / Company List

The Party/Company List displays:

- Party/Company Name
- Mobile Number
- Party Type
- Current Outstanding
- Current Credit

The list must not display:
- GSTIN
- TDS Applicable

The list supports:
- Search
- Combined filters
- Desktop Table/Card toggle
- Mobile compact cards

---

# 8. Party / Company Details

The Party/Company Details page contains:

## Basic Master Information
Complete Party Master information.

## Billing Configuration
- Billing mode
- Billing template
- Numbering series
- Required billing fields
- TDS treatment

## Financial Position

### Receivables
- Total Receivable
- Amount Received
- TDS
- Deductions
- Outstanding

### Credit
- Current Credit Balance
- Credit Generated
- Credit Utilized
- Remaining Credit

### Payment Activity
- Incoming Payment History
- FIFO Allocations
- Specific Trip/Bill Allocations

### Trip / Bill Position
- Total Trips
- Unbilled Amount
- Billed Amount
- Outstanding Bills
- Settled Bills

Related records must be clickable.

---

# 9. Party Billing Configuration

Billing configuration is separate from the Party Master.

Configuration includes:

- Billing Mode
  - Individual
  - Consolidated
- Billing Template
- Billing Numbering Series
- Required Billing Fields
- TDS Treatment

Only Owner can modify billing configuration.

Staff can use the existing configuration to generate and edit Bills.

CA has view-only access.

Changing future billing configuration does not modify historical Bills.

---

# 10. Vehicle Owner

A Vehicle Owner is the provider of a Market Vehicle.

Vehicle Owner Master contains:

- Vehicle Owner Name
- Mobile Number
- Owned Vehicle Numbers
- Status as applicable to the master record

Quick creation from a Trip is allowed.

Quick-created Vehicle Owner records may initially be incomplete.

---

# 11. Vehicle Owner List

The Vehicle Owner List displays:

- Vehicle Owner Name
- Mobile Number
- Number of Owned Vehicles
- Current Payable
- Active / Inactive status

The list supports:
- Search
- Combined filters
- Desktop Table/Card toggle
- Mobile compact cards

---

# 12. Vehicle Owner Details

The Vehicle Owner Details page contains:

## Basic Information
- Name
- Mobile Number
- Active / Inactive

## Owned Vehicles
- Vehicle Numbers
- Linked vehicle details

## Financial Position
- Total Payable
- Amount Paid
- Outstanding Payable

## Trip History
All Trips involving the Vehicle Owner.

## Payment History
Payments made to the Vehicle Owner.

## Documents
Owner-related documents where applicable.

## Activity / Audit History

---

# 13. Market Vehicles

Market Vehicles are vehicles not owned by SRL.

Market Vehicle Master contains:

- Vehicle Number
- Vehicle Owner
- Owner Mobile Number

Market Vehicles do not have a separate operational status field.

Their current usage is determined through Trip records.

Market Vehicles are separate from Own Fleet Vehicles.

---

# 14. Market Vehicle List

The Market Vehicle List displays:

- Vehicle Number
- Vehicle Owner Name
- Owner Mobile Number
- Number of Trips
- No vehicle status field

The list supports:
- Search
- Combined filters
- Desktop Table/Card toggle
- Mobile compact cards

---

# 15. Market Vehicle Details

The details page contains:

## Vehicle Information
- Vehicle Number
- Vehicle Owner
- Owner Mobile Number

## Trip History
- All linked Trips
- Trip Number
- Party/Company
- Route
- Loading/Unloading dates
- Trip status
- Owner payable

## Financial Position
- Total Freight Payable
- Amount Paid
- Outstanding Payable

## Payment History
Payments attributable to the Vehicle Owner for Trips involving the vehicle.

## Documents
Vehicle-related documents where applicable.

## Activity / Audit History

---

# 16. Own Fleet

Own Fleet is managed separately from Market Vehicles.

Each Own Fleet vehicle contains:

- Vehicle Number
- Documents
- Document numbers
- Document expiry dates
- Document files
- Trip history
- Own Fleet expenses
- Financial summary

---

# 17. Own Fleet Operational State

Own Fleet operational state is derived from Trip and maintenance information.

## In Trip

Automatically shown when the vehicle has an active Own Fleet Trip.

The vehicle cannot be assigned to another active Own Fleet Trip.

## Available

The vehicle has:
- No active Own Fleet Trip
- No maintenance restriction

## Under Maintenance

Owner may set the vehicle to maintenance only when it has no active Trip.

A vehicle under maintenance cannot be assigned to a new Own Fleet Trip.

## Sold / Removed

Used when the vehicle permanently leaves SRL's fleet.

The vehicle record and historical data remain preserved.

---

# 18. Own Fleet Financial Summary

The Own Fleet vehicle financial summary includes:

- Freight / Receivable Generated
- Diesel Expense
- FASTag Expense
- Loading Charges
- Unloading Charges
- Border Charges
- Other Expenses
- Total Expenses
- Profit/Loss

These figures are derived from the underlying Trip and Payment records.

---

# 19. Own Fleet Expense Types

Allowed Own Fleet expense types:

- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other

No additional Own Fleet expense category should be introduced without approval.

## Diesel

- Multiple entries allowed.
- Amount
- Date

## FASTag

- Multiple entries allowed.
- Amount
- Date

## Loading

- Optional.
- One applicable amount for the Trip.

## Unloading

- Optional.
- Multiple entries allowed.
- Can be associated with destinations.

## Border

- Amount
- Date defaults to today
- Remark

## Other

- Multiple entries allowed.
- Charge name
- Amount
- Reason/Remark

Actual payment of these expenses is recorded through the Payment Module.

---

# 20. Trip Creation

A Trip contains:

- Trip Number
- Trip Type
- Vehicle Relationship
- Party/Company
- Vehicle
- Driver Mobile
- Origin
- Multiple Destinations
- Loading Date
- Unloading Date
- Financial information
- POD information
- Courier information
- Issues
- Billing relationship
- Payment relationships
- Settlement information

Trip vehicle relationship must be either:

### Market
Market Vehicle + Vehicle Owner

OR

### Own Fleet
Own Fleet Vehicle

Never both.

---

# 21. Trip List

Trip List supports:

- Search
- Combined filters

Tabs:

- All Trips
- Active / In Progress
- Completed
- Unsettled
- Settled
- Cancelled
- Issues
- POD Pending
- Unbilled

Tab counts update automatically.

Filters can narrow the selected tab.

Desktop supports:
- Table
- Card

Mobile uses compact cards.

---

# 22. Trip List Fields

The Trip List displays only:

1. Trip Number
2. Vehicle Number
3. Driver Mobile Number
4. Origin
   - Location
   - City/State
5. Destination
   - Location
   - City/State
6. Trip Status
7. Loading Date
8. Unloading Date

Detailed information belongs in Trip Details.

---

# 23. Trip Lifecycle

General lifecycle:

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
Courier / POD Sent
    ↓
Billing / Payment
    ↓
Settlement

Important:

**Completed does not automatically mean Settled.**

---

# 24. Trip Destinations

A Trip supports multiple destinations.

Each destination can have:

- Destination
- City
- State
- Unloading Date
- Party-side Unloading Charge
- Vehicle-owner Unloading Charge
- Own Fleet Unloading Expense

Destination order must be preserved.

---

# 25. Party / Company Receivables

Party-side financial calculation can include:

- Freight
- Advance/payment allocations
- Balance
- Unloading Charges
- Detention
- Other Charges
- Shortage/Damage Deductions
- TDS
- Total Receivable
- Amount Accounted/Received
- Outstanding
- Credit allocation where applicable

Actual received money comes from Payment records.

---

# 26. Market Vehicle Owner Payables

Vehicle-owner payable calculation can include:

- Base Freight
- Advance/payment allocations
- Balance Payable
- Detention
- Unloading Charges
- Other Charges
- Shortage/Damage Deductions
- Total Payable
- Amount Paid
- Outstanding Payable

Actual money paid to the Vehicle Owner comes from Payment records.

Vehicle Owners do not receive a Credit balance.

---

# 27. Detention

Detention is separately maintained for:

- Party
- Vehicle Owner

The two values may differ.

Detention may include a remark.

Detention is a financial component and is not an operational Issue.

---

# 28. Unloading Charges

Unloading is optional.

A Trip can have multiple destinations.

Each destination may have:

- Party-side unloading charge
- Vehicle-owner unloading charge
- Own Fleet unloading expense where applicable

Party-side and Vehicle-owner values may differ.

---

# 29. Other Charges

Other Charges support multiple entries.

Each entry contains:

- Charge Name / Type
- Amount
- Optional Remark/Reason

Party-side and Vehicle-owner-side charges are maintained independently.

---

# 30. Shortage / Damage

Trip Issues may include:

- Shortage
- Damage

An Issue does not automatically create a financial deduction.

A resolved Issue can exist without a deduction.

If an actual deduction is required, it must be recorded separately as a financial deduction.

Deductions can reduce the receivable/payable and may result in a loss.

---

# 31. TDS

TDS is optional according to the relevant Party/Company configuration.

The actual TDS amount is entered against the Trip.

TDS is not a Payment record.

The actual money received remains recorded through the Payment Module.

TDS information can be reviewed through the Financial/CA workflow.

---

# 32. POD

POD is a physical document.

Rules:

- POD can contain multiple files.
- Upload timestamp is the POD Received timestamp.
- Uploaded By is retained.
- POD status changes when the file is uploaded.

POD is required before the Trip can enter the normal Company billing workflow.

---

# 33. Courier

After POD is received, the Courier section becomes available.

Courier information includes:

- Courier Docket Number
- Courier Envelope File
- Courier Sent Status
- Courier Sent Date/Time
- Sent By

There is no formal follow-up workflow for courier delivery.

For Market Trips, SRL may contact the Party by phone after POD is sent.

---

# 34. Billing Eligibility

A Trip must satisfy the applicable eligibility conditions before billing.

For Company billing:

- Trip must be Completed.
- POD must be received.
- Trip must be Unbilled.
- Trip must belong to the selected Company.

The user manually selects eligible Trips.

A Trip can be included in only one active Bill.

---

# 35. Individual Billing

For Individual billing:

Each selected eligible Trip generates its own Bill.

The Bill uses the Company's configured template and selected numbering series.

---

# 36. Consolidated Billing

For Consolidated billing:

One Bill contains the selected Trips as individual line/items.

Repeatable rows/sections are used to render Trip data.

---

# 37. Bill Numbering

Bill numbering:

- Is configured through Numbering Series.
- User selects the applicable series when generating the Bill.
- Has configurable prefix.
- Uses sequential numbering.
- Resets every Financial Year.
- Never reuses a cancelled Bill number.

---

# 38. Bill Versioning

Bill editing creates a new version.

Example:

Bill Number:
`SRL/26-27/001`

Versions:
- V1
- V2
- V3

Rules:

- Same Bill Number
- New version
- Previous version becomes read-only
- Latest version is current
- Audit information retained
- Updated PDF generated

Editing does not generate a new Bill Number.

---

# 39. Bill Status

Only these statuses exist:

- Generated
- Submitted
- Paid
- Cancelled

There is no Partially Paid status.

Paid status is determined by active Payment allocations.

---

# 40. Bill Cancellation

Cancellation requires:

- Cancellation reason
- Cancelled By
- Cancellation Date/Time

On cancellation:

- Bill becomes Cancelled.
- Linked Trips return to Unbilled.
- Active Bill details/PDF files are removed from active storage.
- Lightweight cancellation metadata is retained.
- Cancelled Bill cannot be restored.
- A new Bill may be generated for the Trips.

---

# 41. Payment Module

The Payment Module is the authoritative source of actual money movement.

Payment types:

## Incoming

- Company Payment
- Market Party Payment
- Other Business Receipt

## Outgoing

- Vehicle Owner Payment
- Own Fleet Expense
- Other Business Payment

Payment modes:

- UPI
- Bank Transfer
- Cash

---

# 42. Payment Creation

Payment creation begins with:

Payment Type
    ↓
Incoming / Outgoing

For Incoming:

- Company Payment
- Market Party Payment
- Other Business Receipt

For Outgoing:

- Vehicle Owner Payment
- Own Fleet Expense
- Other Business Payment

The remainder of the form changes according to the selected category.

---

# 43. Incoming Payments

Company/Market Party incoming payments support:

### Specific Bill
Payment is allocated to a specific Bill.

### Specific Trip
Payment is allocated to a specific Trip.

### Bulk / FIFO
Payment is allocated through FIFO against eligible outstanding receivables.

If payment exceeds applicable outstanding receivables:

Excess → Credit

A completed payment cannot remain partially allocated.

---

# 44. Other Business Receipt

Other Business Receipt contains:

- Category / Name
- Amount
- Date
- Payment Mode
- Mandatory Remark
- Optional Attachment

It is a standalone Payment record.

---

# 45. Outgoing Vehicle Owner Payment

Vehicle Owner Payment contains:

- Vehicle Owner
- Relevant Trip/allocation
- Amount
- Date
- Payment Mode
- Optional Attachment
- Allocation details

Vehicle Owner overpayment does not create a Vehicle Owner Credit balance.

---

# 46. Own Fleet Expense Payment

Own Fleet Expense Payment contains:

- Own Fleet Vehicle/Trip context
- Expense Type
- Amount
- Date
- Payment Mode
- Optional Attachment
- Relevant remark/reason where applicable

Allowed categories:

- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other

---

# 47. Other Business Payment

Other Business Payment contains:

- Category / Name
- Amount
- Date
- Payment Mode
- Mandatory Remark
- Optional Attachment

It is a standalone Payment record.

Other Business Payments reduce the payment-based business result.

---

# 48. Payment Editing

Payments can be edited.

Editing:
- Keeps the same Payment ID.
- Preserves previous values in audit history.
- Stores new values.
- Records who edited it.
- Records when it was edited.

---

# 49. Payment Reallocation

Owner can reallocate a Payment.

Rules:

- Warning is shown.
- Existing allocation is changed.
- Affected Trip/Bill balances are recalculated.
- Credits are recalculated.
- Settlement states are recalculated.
- Audit record is created.
- Payment ID remains unchanged.

---

# 50. Payment Reversal

Only Owner can reverse Payments.

Reversal requires a reason.

After reversal:

- Payment remains in history.
- Status becomes Reversed.
- Allocations are reversed.
- Credits are recalculated.
- Trip/Bill settlement calculations are recalculated.
- Financial Reports exclude the reversed payment.
- Reversed payment cannot be restored.

A new Payment must be created for any subsequent transaction.

---

# 51. Payment Permissions

## Owner
- Create
- Edit
- Reverse
- Reallocate
- Create bulk/FIFO payment
- View

## Staff
- Create
- Edit
- View

Staff cannot:
- Reverse
- Delete
- Reallocate
- Create FIFO bulk/unallocated payments

## CA
- View only

---

# 52. Payment Details

Payment Details contains:

## Payment Information
- Payment ID
- Date
- Type
- Category
- Amount
- Mode
- Status
- Created By
- Created Date/Time
- Last Edited By
- Last Edited Date/Time

## Relationships
- Party/Company
- Vehicle Owner
- Own Fleet
- Other Business Category
- Trip
- Bill

## Allocation
- Allocated Amount
- Allocation Type
- Trip/Bill
- Allocation Date
- FIFO Details
- Remaining Unallocated
- Credit Generated

## Attachment

## Reversal Details

## Audit History

---

# 53. Payment List

Payment List displays:

- Payment ID
- Date
- Type
- Entity
- Category
- Amount
- Mode
- Status

Filters:

- Date
- Financial Year
- Incoming/Outgoing
- Entity
- Category
- Mode
- Status
- Trip
- Bill

Display:
- Desktop Table/Card
- Mobile Compact Cards

---

# 54. Financial Reports

Financial Reports are generated exclusively from Payment Module records.

They do not independently generate transactions from Trips or Bills.

Reports include:

- Payment Summary
- P&L
- Financial Year Records
- TDS
- CA / Tax / ITR workspace

---

# 55. Payment Summary

Payment Summary includes:

- Total Incoming
- Total Outgoing
- Net P&L
- Payment Count
- Reversed Payment Count

Breakdowns:

### Incoming
- Company Payments
- Market Party Payments
- Other Business Receipts

### Outgoing
- Vehicle Owner Payments
- Own Fleet Expenses
- Other Business Payments

Filters:

- Financial Year
- Date Range
- Payment Type
- Category
- Entity
- Payment Mode

Only Active Payments contribute to financial totals.

---

# 56. Payment-Based P&L

The application's operational P&L is:

**Net P&L = Active Incoming Payments - Active Outgoing Payments**

Incoming:

- Company Payments
- Market Party Payments
- Other Business Receipts

Outgoing:

- Vehicle Owner Payments
- Own Fleet Expenses
- Other Business Payments

Reversed payments do not contribute to totals.

This is a payment-based business report, not a statutory accounting statement.

---

# 57. Financial Year Records

Financial Year Records provide:

- Total Incoming
- Total Outgoing
- Net P&L
- Payment Count
- Category-wise totals
- Monthly breakdown
- Underlying payment records
- Reversed payment history
- Exportable financial-year data

The selected Financial Year is the primary scope.

---

# 58. TDS Reporting

TDS reporting contains:

- Party/Company
- Trip Number
- TDS Amount
- Related Payment(s)
- Financial Year
- Date
- TDS Status/Position

Filters:

- Financial Year
- Party/Company
- Date Range
- Trip

TDS can link to the relevant Trip and Payment records.

---

# 59. CA / Tax / ITR

CA workspace is read-only.

It provides access to:

- Payment-based income/receipt records
- Payment-based expense records
- P&L
- Financial-year summaries
- TDS
- Reversed payment history
- Relevant Trips
- Relevant Bills
- Supporting documents
- Exportable records

CA cannot modify these records.

---

# 60. Documents

Documents can be attached to:

- Trips
- Parties / Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet Vehicles
- Payments
- Bills
- Other supported business records

Multiple files per document type are allowed where applicable.

Document metadata includes:

- File Name
- Document Type
- Upload Date/Time
- Uploaded By
- File Size
- File Reference

---

# 61. Document Permissions

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

# 62. Own Fleet Document Expiry

Own Fleet document expiry alerts are generated:

- 7 days before expiry
- On dashboard
- As in-app toast notifications
- Daily until the document is updated/renewed

Dismissing a toast does not stop future reminders.

General reminder functionality is outside this requirement.

---

# 63. Document Replacement

When a new Own Fleet document of the same type replaces an old one:

- New document becomes active.
- Old document becomes inactive.
- Old file is deleted.
- Historical metadata remains:
  - Document Type
  - Document Number
  - Old Expiry Date
  - Replacement Date
  - Replaced By

---

# 64. Generated Bill Files

Generated Bill PDFs are stored by default.

Owner can delete the PDF.

Deleting the PDF does not delete:
- Bill
- Bill version
- Structured template
- Bill data

PDF can be regenerated from the stored structured Bill and template.

Staff can:
- View
- Download

Staff cannot delete generated Bill PDFs.

---

# 65. Trip Issues

Issues include:

- Shortage
- Damage

Issue workflow:

Issue Created
    ↓
Investigation/Handling
    ↓
Resolved/Closed

An Issue does not automatically produce a deduction.

Financial deductions are separate.

---

# 66. Global Search

Global Search searches:

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

Results are grouped by record type.

Each result opens its source record.

---

# 67. Navigation and Context

When navigating between linked records, the system should preserve navigation context where practical.

Example:

Payment
    ↓
Trip
    ↓
Party
    ↓
Back

should return through the logical previous context.

List search/filter/pagination state should be preserved where practical.

---

# 68. Historical Data

Core structured records are retained indefinitely.

The application must support multi-year historical access.

Historical records include:

- Trips
- Payments
- Bills
- Bill Versions
- Parties
- Vehicle Owners
- Vehicles
- TDS
- Financial records
- Audit records

---

# 69. Business Rules That Must Not Be Violated

1. Payment Module is the source of truth for actual money movement.
2. Financial Reports are generated from Payment records.
3. Trip calculations are not duplicate payment records.
4. Bills do not replace Payments.
5. Market Vehicles and Own Fleet Vehicles are separate.
6. Market Vehicles have no status field.
7. Own Fleet vehicle state is derived from active Trips and maintenance state.
8. Own Fleet Trips have no Vehicle Owner payable side.
9. Market Trips have Vehicle Owner payable calculations.
10. Completed does not automatically mean Settled.
11. Issue does not automatically mean Deduction.
12. Company billing requires applicable POD/completion conditions.
13. A Trip cannot belong to multiple active Bills.
14. Bill edits create versions rather than new Bill Numbers.
15. Bill numbers reset each Financial Year.
16. Cancelled Bill numbers are never reused.
17. Bills have only Generated, Submitted, Paid and Cancelled statuses.
18. There is no Partially Paid Bill status.
19. Payment reversal is not deletion.
20. Reversed Payments remain historically accessible.
21. Vehicle Owners do not receive Credit balances.
22. Company/Market Party excess incoming payments become Credit.
23. Completed Payments cannot remain partially allocated.
24. Historical structured records must remain accessible.
25. Role permissions must be enforced by the backend.
26. Do not invent business rules not defined in the requirements.

---

# 70. Requirement Change Rule

If a future business decision changes one of these rules:

1. The affected documentation must be updated.
2. Related workflows must be reviewed.
3. Data model impact must be reviewed.
4. API/business-logic impact must be reviewed.
5. Existing data migration requirements must be reviewed.
6. Tests must be updated.
7. The change must not be silently introduced only in code.

The documentation and implementation must remain synchronized.