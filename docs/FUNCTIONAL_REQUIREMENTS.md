# Shri Sanwariya Road Lines (SRL)
# Functional Requirements

## 1. Purpose

This document defines the functional behavior of the SRL application.

It specifies:
- What each module must provide
- What users can do
- What validations are required
- What system actions occur after operations
- How modules interact
- What information must be displayed
- What restrictions must be enforced

Business rules are defined in:
`docs/BUSINESS_REQUIREMENTS.md`

This document converts those rules into application functionality.

---

# 2. Application Navigation

The primary navigation is grouped into:

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

Navigation visibility must respect user permissions.

---

# 3. Authentication

## 3.1 Login

Users authenticate using:

- Mobile Number
- Password

The system must:
- Validate credentials
- Reject inactive accounts
- Create a secure authenticated session
- Record successful login time
- Apply login rate limiting
- Apply failed-login throttling

Incorrect credentials must not reveal whether the mobile number or password was incorrect.

---

## 3.2 Session

Authenticated sessions must:
- Be securely generated
- Expire according to the configured security policy
- Be revocable
- Not expose plaintext session secrets
- Be invalidated when the user is deactivated where applicable

---

# 4. Dashboard

The Dashboard is role-aware.

## 4.1 Header

Display:
- User name
- Current date

---

## 4.2 Business Snapshot

Display:
- Trips
- Receivable
- Payable
- Profit/Loss

Displayed values must come from the appropriate underlying business records.

---

## 4.3 Needs Attention

Display relevant actionable items such as:
- POD Pending
- Unsettled Trips
- Bills
- Issues
- Expiring Documents

Fleet document expiry alerts follow the 7-day expiry rule.

---

## 4.4 Financial Position

Display:
- Company Outstanding
- Market Outstanding
- Vehicle Owner Payable
- Credits

These figures must use the appropriate business/operational calculations and must not create duplicate financial transactions.

---

## 4.5 Trip Activity

Provide visibility into recent/current Trip activity.

---

## 4.6 Own Fleet Performance

Display relevant monthly Own Fleet performance.

---

## 4.7 Recent Payments

Display recent Payment records.

---

## 4.8 Dashboard Navigation

Dashboard metrics should be clickable.

Clicking a metric should navigate to the relevant filtered records.

Example:

POD Pending
→ Trips filtered to POD Pending

Recent Payment
→ Payment Details

---

# 5. Party / Company Module

## 5.1 Party List

Display only:

- Party/Company Name
- Mobile Number
- Party Type
- Current Outstanding
- Current Credit

Do not display:
- GSTIN
- TDS Applicable

---

## 5.2 Search

Search Party records using relevant fields including:
- Name
- Mobile number

---

## 5.3 Filters

Support combined filtering.

Filters may include:
- Party Type
- Status
- Financial position where applicable

---

## 5.4 Display Modes

Desktop:
- Table
- Card

Mobile:
- Compact Cards

---

## 5.5 Create Party

Create form must support:

- Party/Company Name
- Primary Mobile Number
- Full Address
- City
- State
- PIN Code
- GSTIN
- Party Type
- Billing Address
- TDS Applicable

The system must validate required fields.

---

## 5.6 Edit Party

Authorized users can edit Party Master information.

Editing Party Master information must not silently modify historical Trip or Bill records.

---

## 5.7 Party Details

Party Details must contain:

### Master Information
Complete Party Master.

### Billing Configuration
- Billing Mode
- Template
- Numbering Series
- Required Billing Fields
- TDS Treatment

### Financial Position

#### Receivables
- Total Receivable
- Amount Received
- TDS
- Deductions
- Outstanding

#### Credit
- Current Credit
- Credit Generated
- Credit Utilized
- Remaining Credit

#### Payment Activity
- Incoming payments
- FIFO allocations
- Specific Trip/Bill allocations

#### Trip/Bill Position
- Total Trips
- Unbilled Amount
- Billed Amount
- Outstanding Bills
- Settled Bills

All related records should be clickable.

---

## 5.8 Billing Configuration Permissions

Owner:
- Full configuration access

Staff:
- Can use configuration
- Cannot modify configuration

CA:
- View only

---

# 6. Vehicle Owner Module

## 6.1 List

Display:
- Vehicle Owner Name
- Mobile Number
- Number of Owned Vehicles
- Current Payable
- Active/Inactive

---

## 6.2 Vehicle Owner Search

Search by:
- Name
- Mobile number

---

## 6.3 Vehicle Owner Details

Sections:

### Basic Information
- Name
- Mobile
- Active/Inactive

### Owned Vehicles
- Vehicle Numbers
- Vehicle details

### Financial Position
- Total Payable
- Amount Paid
- Outstanding

### Trip History

### Payment History

### Documents

### Activity/Audit History

---

# 7. Market Vehicle Module

## 7.1 Market Vehicle List

Display:
- Vehicle Number
- Vehicle Owner
- Owner Mobile
- Number of Trips

Do not create/display a Market Vehicle status field.

---

## 7.2 Market Vehicle Creation

Fields:
- Vehicle Number
- Vehicle Owner

Vehicle Owner must reference an existing Vehicle Owner record.

Quick creation of an incomplete Vehicle Owner is allowed where the Trip workflow requires it.

---

## 7.3 Market Vehicle Details

Display:
- Vehicle information
- Owner
- Trip history
- Financial position
- Payment history
- Documents
- Activity/Audit history

---

# 8. Own Fleet Module

## 8.1 Own Fleet List

Display:
- Vehicle Number
- Current Operational State
- Trips This Month
- Freight/Receivable This Month
- Expenses This Month
- Profit/Loss This Month
- Document Alert

---

## 8.2 Own Fleet State

Operational state is determined as:

### In Trip
If the vehicle has an active Own Fleet Trip.

### Under Maintenance
If Owner has placed the vehicle under maintenance and there is no active Trip.

### Available
If:
- No active Trip
- Not under maintenance

### Sold/Removed
If permanently removed from the fleet.

---

## 8.3 Maintenance

Owner can place a vehicle under maintenance only if it has no active Trip.

A vehicle under maintenance:
- Cannot be assigned to a new Own Fleet Trip.

---

## 8.4 Own Fleet Details

Display:

### Vehicle Information
- Vehicle Number
- Current state

### Documents
- Type
- Number
- Expiry
- File
- Active/inactive history

### Financial Summary
- Freight/Receivable
- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other
- Total Expenses
- Profit/Loss

### Trip History

### Expense History

### Payment History

### Document Replacement History

### Audit History

---

# 9. Trip Module

## 9.1 Trip List

Search and filters appear at the top.

Tabs:

- All Trips
- Active/In Progress
- Completed
- Unsettled
- Settled
- Cancelled
- Issues
- POD Pending
- Unbilled

Each tab displays a live count.

Filters can narrow the selected tab.

---

## 9.2 Trip List Display

Desktop:
- Table
- Card

Mobile:
- Compact Cards

---

## 9.3 Trip List Fields

Only display:

1. Trip Number
2. Vehicle Number
3. Driver Mobile
4. Origin
5. Destination
6. Trip Status
7. Loading Date
8. Unloading Date

Origin:
- Location
- City/State

Destination:
- Location
- City/State

Do not add additional Trip List fields without approval.

---

# 10. Trip Creation

Trip creation must determine:

- Trip Type
- Vehicle Relationship
- Party/Company
- Vehicle
- Driver
- Journey
- Dates

Vehicle Relationship must be one of:

### Market
Requires:
- Market Vehicle
- Vehicle Owner relationship

### Own Fleet
Requires:
- Own Fleet Vehicle

The system must prevent assigning both vehicle relationship types to the same Trip.

---

# 11. Trip Details

Trip Details must contain:

## 11.1 Trip Overview
- Trip Number
- Trip Type
- Vehicle Relationship
- Trip Status
- Party/Company Name
- Party/Company Mobile
- Vehicle Number
- Driver Mobile
- Vehicle Owner Name/Mobile for Market Trips
- Origin
- Loading Date
- Unloading Date

---

## 11.2 Party/Company

Display:
- Name
- Mobile

Link to Party Master for complete information.

---

## 11.3 Vehicle Owner

For Market Trips:
- Name
- Mobile

Link to Vehicle Owner Master.

---

## 11.4 Journey & Destinations

Each destination contains:
- Destination
- Unloading Date
- Party unloading charge
- Vehicle-owner unloading charge
- Own Fleet unloading expense where applicable

Multiple destinations must be supported. Destination identity is persistent. Existing destinations are edited in place. Removal is rejected when linked financial records exist.

---

## 11.5 Party Receivables

Display:
- Freight
- Payment allocations
- Balance
- Unloading charges
- Detention
- Other charges
- Shortage/damage deductions
- TDS
- Total receivable
- Amount accounted/received
- Outstanding
- Credit allocation where applicable

---

## 11.6 Vehicle Owner Payables

For Market Trips:

- Vehicle Owner
- Base Freight
- Payment allocations
- Balance payable
- Detention
- Unloading charges
- Other charges
- Shortage/damage deductions
- Total payable
- Amount paid
- Outstanding payable

---

## 11.7 Own Fleet Expenses

For Own Fleet Trips:

- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other
- Total Expenses
- Expense Payment Records

Do not display Trip P&L inside this section.

---

## 11.8 POD & Courier

Display:
- POD Status
- POD Files
- POD Received Date/Time
- Uploaded By
- LR Information
- Invoice Information
- Courier Docket
- Courier Envelope
- Courier Sent Status
- Courier Sent Date/Time

---

## 11.9 Issues

Display:
- Shortage
- Damage
- Issue Details
- Status
- Resolution/Closure
- Supporting Documents

Issues must not automatically create deductions.

---

## 11.10 Billing

Display:
- Billing Status
- Bill Number
- Bill Version
- Current/Previous version relationship
- Bill Date
- Billing Mode
- Included Bill Information
- Generated Bill Document
- Bill Payment Links

---

## 11.11 Payment History

Display:
- Payment ID
- Date
- Type/Category
- Amount
- Mode
- Allocation
- Status

Payments link to the actual Payment record.

---

## 11.12 Settlement

Display:
- Party-side settlement
- Owner-side settlement where applicable
- Overall Trip Settlement
- Own Fleet settlement where applicable

Completed must not automatically be treated as Settled.

---

## 11.13 Trip Profit/Loss

Trip-level Profit/Loss is a separate section.

It uses the Trip's applicable receivable, payable and expense calculations.

This is distinct from the Payment-based Financial Reports P&L.

---

## 11.14 Documents

Display:
- POD
- Courier Envelope
- Issue Documents
- Payment Attachments where linked
- Other Trip Attachments

Multiple files per type are supported.

---

## 11.15 Activity/Audit

Display relevant Trip actions and edits.

Payment audit remains authoritative in the Payment Module.

---

# 12. POD Functionality

## Upload POD

When a POD is uploaded:
- Store document through the Documents system.
- Set POD Received timestamp to upload timestamp.
- Record uploading user.
- Update POD status.

Multiple POD files may be uploaded.

POD is required for normal Company billing eligibility.

---

# 13. Courier Functionality

Courier fields become available after POD is received.

Required operational actions:

- Enter docket number
- Upload courier envelope
- Mark Courier Sent

When Courier Sent is performed:
- Store timestamp
- Record user
- Update status

---

# 14. Issue Functionality

Users can create:

- Shortage Issue
- Damage Issue

An Issue has:
- Description
- Status
- Resolution
- Supporting Documents

Closing an Issue does not automatically create a deduction.

---

# 15. Payment Module

## 15.1 Payment List

Display:

- Payment ID
- Date
- Type
- Entity
- Category
- Amount
- Mode
- Status

---

## 15.2 Payment Filters

Support:
- Search
- Date
- Financial Year
- Incoming/Outgoing
- Entity
- Category
- Mode
- Status
- Trip
- Bill

---

## 15.3 Payment Creation

First step:

### Payment Type
- Incoming
- Outgoing

---

## 15.4 Incoming Payment

Source/category:

- Company Payment
- Market Party Payment
- Other Business Receipt

Company/Market Party payment requires Party selection.

Other Business Receipt requires:
- Category/Name
- Amount
- Date
- Mode
- Mandatory remark
- Optional attachment

---

## 15.5 Incoming Allocation

For Company/Market Party:

### Specific Bill
Select Bill and allocate payment.

### Specific Trip
Select Trip and allocate payment.

### Bulk/FIFO
Automatically allocate according to FIFO rules.

If payment exceeds eligible outstanding receivables:
- Excess becomes Credit.

Payment must be fully accounted for.

---

# 16. Outgoing Payment

Source/category:

- Vehicle Owner Payment
- Own Fleet Expense
- Other Business Payment

---

## 16.1 Vehicle Owner Payment

Requires:
- Vehicle Owner
- Trip/allocation
- Amount
- Date
- Mode
- Optional attachment

No Vehicle Owner Credit is created.

---

## 16.2 Own Fleet Expense Payment

Requires:
- Trip
- Expense category
- Amount
- Date
- Mode
- Optional attachment
- Relevant remark/reason where applicable

Allowed categories:
- Diesel
- FASTag
- Loading
- Unloading
- Border
- Other

---

## 16.3 Other Business Payment

Requires:
- Category/Name
- Amount
- Date
- Mode
- Mandatory remark
- Optional attachment

---

# 17. Payment Editing

When a Payment is edited:

- Same Payment ID remains.
- Old values remain available in audit history.
- New values are stored.
- Editor is recorded.
- Edit timestamp is recorded.

---

# 18. Payment Reallocation

Only Owner can reallocate.

Before reallocation:
- Show warning.

After reallocation:
- Update allocations.
- Recalculate affected Trip/Bill positions.
- Recalculate Credit.
- Recalculate Settlement.
- Create audit entry.

Payment ID remains unchanged.

---

# 19. Payment Reversal

Only Owner can reverse.

Reversal requires:
- Reason
- Confirmation

After reversal:
- Status = Reversed
- Allocations are reversed
- Related financial calculations recalculate
- Settlement calculations recalculate
- Reports exclude the payment from financial totals
- Historical record remains

No restoration is supported.

---

# 20. Payment Details

Display:

### Payment Information
- Payment ID
- Date
- Type
- Category
- Amount
- Mode
- Status
- Created By
- Created At
- Last Edited By
- Last Edited At

### Relationships
- Party/Company
- Vehicle Owner
- Own Fleet
- Other Business Category
- Trip
- Bill

### Allocation
- Allocated Amount
- Allocation Type
- Trip/Bill
- Allocation Date
- FIFO Details
- Remaining Unallocated
- Credit Generated

### Attachment

### Reversal

### Audit History

---

# 21. Bills Module

## 21.1 Bill List

Display:
- Bill Number
- Version
- Party/Company
- Billing Date
- Number of Trips
- Bill Amount
- Amount Received
- Outstanding
- Status

Statuses:
- Generated
- Submitted
- Paid
- Cancelled

---

## 21.2 Bill Filters

Support:
- Search
- Date
- Financial Year
- Party/Company
- Status
- Billing Mode
- Payment Status
- Trip

---

# 22. Bill Creation

Workflow:

Select Party/Company
    ↓
Use configured Billing Mode
    ↓
Select eligible Trips
    ↓
Select Billing Series
    ↓
Load Template
    ↓
Review
    ↓
Generate Bill
    ↓
Generate PDF

Eligible Trips:
- Completed
- POD received
- Unbilled
- Belong to selected Company

---

# 23. Individual Bill Generation

For Individual billing:

Each selected Trip produces a separate Bill.

Each Bill:
- Gets its own Bill Number.
- Uses the selected Numbering Series.
- Uses configured Company template.

---

# 24. Consolidated Bill Generation

For Consolidated billing:

- One Bill is generated.
- Selected Trips appear as individual line/items.
- Repeatable Bill Designer sections render Trip data.

---

# 25. Bill Status Behavior

## Generated

Initial generated state.

## Submitted

Set when the Bill is submitted/sent to the Party/Company.

## Paid

System-derived when full Bill amount has been accounted for through active Payment allocations.

## Cancelled

Set through Bill cancellation.

There is no Partially Paid status.

---

# 26. Bill Editing

Editing an existing Bill:

1. Load current version.
2. User edits permitted data.
3. Validate changes.
4. Create new version.
5. Previous version becomes read-only.
6. New version becomes current.
7. Same Bill Number remains.
8. Generate updated PDF.
9. Update applicable related calculations.
10. Create audit record.

---

# 27. Bill Cancellation

Cancellation:
1. User selects Cancel.
2. System requires reason.
3. User confirms.
4. Bill becomes Cancelled.
5. Linked Trips become Unbilled.
6. Active Bill details/PDF files are removed from active storage.
7. Lightweight cancellation metadata remains.
8. Bill cannot be restored.

---

# 28. Bill Details

Display:

### Bill Information
- Bill Number
- Version
- Party/Company
- Bill Date
- Billing Mode
- Billing Series
- Status
- Created By/Date
- Last Edited By/Date

### Trips
- Included Trips
- Trip Number
- Route
- Dates
- Amount

### Financial Summary
- Gross Bill Amount
- TDS
- Deductions
- Net Bill Amount
- Amount Received
- Outstanding

### Payment History
- Payment ID
- Date
- Amount
- Mode
- Allocation Status

### Bill Document
- Current PDF
- View
- Download
- Regenerate

### Version History
- Current version
- Previous versions
- Changed By
- Date/Time
- Change information

### Activity/Audit

---

# 29. Bill Designer

## 29.1 Template Management

Display:
- Template Name
- Company/Party
- Billing Mode
- Status
- Last Modified
- Modified By

Actions:
- Create
- Edit
- Preview
- Duplicate
- Activate
- Deactivate

Owner controls configuration.

Staff can use existing templates.

---

## 29.2 Template Import

New template workflow:

Upload PDF/JPG/PNG
    ↓
Automatic Reconstruction
    ↓
Editable Template
    ↓
Review/Correction
    ↓
Save

Uploaded reference must not become a permanent static background.

---

## 29.3 Editor Layout

### Left Panel
Elements and fields.

### Center
Page canvas.

### Right Panel
Properties of selected element.

---

## 29.4 Dynamic Fields

Field groups:

- Party/Company
- Trip
- Vehicle
- Vehicle Owner
- Journey/Destinations
- Receivables
- Vehicle Owner Payables
- Own Fleet Expenses
- POD/LR/Invoice
- Issues
- Billing
- Payment
- System/Bill Information
- Calculated Fields

Fields must be searchable.

---

## 29.5 Repeatable Elements

Support:
- Repeatable Row
- Repeatable Section

Examples:
- Trip rows
- Destination rows/sections

---

# 30. Financial Reports

Financial Reports are generated exclusively from Payments.

## 30.1 Payment Summary

Display:
- Total Incoming
- Total Outgoing
- Net P&L
- Payment Count
- Reversed Payment Count

Breakdowns:
- Incoming by Category
- Outgoing by Category

Filters:
- Financial Year
- Date Range
- Payment Type
- Category
- Entity
- Payment Mode

---

## 30.2 P&L

Calculation:

Active Incoming Payments
-
Active Outgoing Payments
=
Net P&L

Reversed Payments are excluded from totals.

---

## 30.3 Financial Year Records

Display:
- Total Incoming
- Total Outgoing
- Net P&L
- Payment Count
- Category totals
- Monthly breakdown
- Underlying payments
- Reversed payment history

Support export.

---

## 30.4 TDS

Display:
- Party/Company
- Trip
- TDS Amount
- Related Payments
- FY
- Date
- Status/Position

Filters:
- FY
- Party/Company
- Date
- Trip

---

## 30.5 CA/Tax/ITR

CA can:
- View
- Filter
- Review
- Export

CA cannot modify records.

---

# 31. Documents Module

## 31.1 Documents List

Display:
- File Name
- Document Type
- Related Record
- Uploaded By
- Upload Date/Time
- File Size
- Status/Availability

---

## 31.2 Document Search/Filters

Support:
- Search
- Document Type
- Related Module
- Related Record
- Uploaded By
- Date Range

---

## 31.3 Document Details

Display:
- File Information
- Related Record
- File actions
- History

Actions depend on permissions.

---

# 32. Own Fleet Document Alerts

System checks Own Fleet document expiry.

Alert:
- 7 days before expiry
- Dashboard
- In-app toast
- Daily until updated/renewed

Dismissing a toast does not disable the reminder.

---

# 33. Users & Roles

Owner-only module.

List:
- User Name
- Mobile/Login
- Role
- Status
- Created Date
- Last Login

Actions:
- Create User
- Edit User
- Activate
- Deactivate
- Reset Login Access

Staff and CA cannot access User Management.

---

# 34. Settings

Owner-only configuration.

Areas:
- Business Profile
- Financial Year
- Payment Settings
- Trip/Operational Settings
- Document/Storage Settings
- Notification Settings
- Numbering/Identifier Settings
- Security/Account Settings

---

# 35. Global Search

Search across:

- Trip Number
- Vehicle Number
- Party/Company
- Vehicle Owner
- Mobile Numbers
- Bill Number
- Payment ID
- LR Number
- Invoice Number
- Courier Docket Number
- Relevant document information

Results grouped into:
- Trips
- Parties
- Vehicles
- Vehicle Owners
- Bills
- Payments
- Documents

Opening a result opens its source record.

---

# 36. Navigation Context

When opening linked records:
- Preserve navigation path.
- Preserve previous search/filter state where practical.
- Browser back should follow logical navigation.
- Global Search should return to search results when navigating back.

---

# 37. Validation Principles

The system must validate:

- Required fields
- Correct entity relationships
- Allowed statuses
- Financial amounts
- Payment allocation amounts
- Trip vehicle relationship
- Bill eligibility
- Bill duplication
- Payment permissions
- Document permissions
- Own Fleet assignment restrictions

Validation must occur on the backend.

Frontend validation is supplementary and cannot replace backend validation.

---

# 38. Financial Integrity

The system must prevent:

- Duplicate Payment records caused by other modules
- Payment allocations exceeding Payment amount
- Partial unexplained Payment balances
- Vehicle Owner Credit creation
- Billing an ineligible Trip
- Billing the same Trip into multiple active Bills
- Assigning an Own Fleet vehicle already in an active Trip
- Assigning an Own Fleet vehicle under maintenance
- Reusing cancelled Bill numbers
- Editing historical Bill versions
- Restoring reversed Payments

---

# 39. Audit Requirements

Important actions must create audit records.

Examples:
- Trip creation/edit
- Bill creation/edit/version/cancellation
- Payment creation/edit/reallocation/reversal
- Master changes
- User changes
- Document replacement/deletion
- Configuration changes

Payment audit must preserve financial changes.

---

# 40. Error Handling

Errors must:
- Clearly explain what failed.
- Avoid exposing sensitive system information.
- Preserve transaction integrity.
- Not partially apply financial operations.

Financial operations should use transactional processing where multiple records must change together.

Example:

Payment Reversal:

Payment
+ Allocation
+ Credit
+ Settlement
+ Audit

must remain consistent.

---

# 41. Concurrency

The system must handle simultaneous actions safely.

Examples:
- Two users attempting to bill the same Trip.
- Two users attempting to allocate the same Payment.
- Owner changing a billing configuration while Staff generates a Bill.
- Two users attempting to assign the same Own Fleet vehicle.

Backend/database constraints must prevent inconsistent states.

---

# 42. Historical Integrity

Editing a current master record must not silently rewrite historical records unless explicitly defined by the business rule.

Historical:
- Payment records
- Bill versions
- Audit records
- Trip history

must remain traceable.

---

# 43. Module Relationship Summary

Operations:

Party
    ↓
Trip
    ↓
POD
    ↓
Bill

Market:

Vehicle Owner
    ↓
Market Vehicle
    ↓
Trip
    ↓
Vehicle Owner Payable

Own Fleet:

Own Fleet Vehicle
    ↓
Trip
    ↓
Own Fleet Expense

Actual Money:

Payment
    ↓
Allocation
    ↓
Trip/Bill/Credit

Reporting:

Payment
    ↓
Financial Reports

Documents:

Business Record
    ↓
Document

---

# 44. Implementation Rule

When implementing any feature:

1. Read the relevant business requirements.
2. Read the relevant functional requirements.
3. Check role permissions.
4. Check data-model dependencies.
5. Implement backend validation.
6. Implement frontend behavior.
7. Add audit behavior where required.
8. Add tests.
9. Verify related modules.
10. Do not silently change documented behavior.

If implementation requires an undefined business decision, stop and request clarification instead of guessing.