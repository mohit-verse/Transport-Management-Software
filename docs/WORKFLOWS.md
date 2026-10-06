# Workflows

## 1. Purpose

This document defines the approved business workflows for the Shri Sanwariya Road Lines (SRL) application.

Workflows describe how records move through the system and how related modules must remain synchronized.

The workflows in this document must not introduce business rules that are not defined in the approved requirements.

---

# 2. User Authentication Workflow

The application uses:

- Mobile Number
- Password

The basic workflow is:

```text
Enter Mobile Number
        ↓
Enter Password
        ↓
Validate Credentials
        ↓
Authenticate User
        ↓
Load User Role
        ↓
Load Role-Based Access
        ↓
Open Application
```

Security controls must be enforced by the backend.

---

# 3. Trip Creation Workflow

A Trip begins when SRL receives a transport requirement.

The general workflow is:

```text
Transport Requirement
        ↓
Create Trip
        ↓
Select Party / Company
        ↓
Select Vehicle Relationship
        ↓
Select / Enter Vehicle
        ↓
Enter Driver Mobile
        ↓
Enter Origin
        ↓
Enter Destination(s)
        ↓
Enter Loading / Unloading Information
        ↓
Enter Applicable Financial Information
        ↓
Save Trip
```

For Market Vehicle Trips, the Trip must identify the applicable Vehicle Owner.

For Own Fleet Trips, the Trip must identify the Own Fleet Vehicle.

---

# 4. Market Trip Workflow

The Market Trip workflow is:

```text
Party Requirement
        ↓
Rate Negotiation
        ↓
Trip Creation
        ↓
Market Vehicle + Vehicle Owner
        ↓
Loading
        ↓
Travel
        ↓
Unloading
        ↓
Trip Completed
        ↓
POD Received
        ↓
POD Uploaded
        ↓
Courier Information
        ↓
POD Sent to Party
        ↓
Party Payment
        ↓
Vehicle Owner Payment
        ↓
Financial Settlement
        ↓
Trip Settled
```

Rate negotiation occurs outside the system where applicable.

The application records the resulting Trip and financial information.

---

# 5. Company Trip Workflow

The Company/Vendorship workflow is:

```text
Company Transport Requirement
        ↓
Trip Creation
        ↓
Vehicle Assignment
        ↓
Loading
        ↓
Travel
        ↓
Unloading
        ↓
Trip Completed
        ↓
POD Received
        ↓
Trip Becomes Billing Eligible
        ↓
User Selects Completed + Unbilled Trips
        ↓
Generate Bill
        ↓
Submit Bill to Company
        ↓
Company Payment
        ↓
Payment Allocation
        ↓
Bill Paid
        ↓
Trip Settlement
```

Company trips do not use a Company advance workflow.

---

# 6. Own Fleet Trip Workflow

Own Fleet Trips use SRL-owned vehicles.

The workflow is:

```text
Own Fleet Vehicle Available
        ↓
Create Own Fleet Trip
        ↓
Vehicle State → In Trip
        ↓
Loading
        ↓
Travel
        ↓
Unloading
        ↓
Trip Completed
        ↓
POD Received
        ↓
Party Payment
        ↓
Own Fleet Expenses
        ↓
Party-side Settlement
        ↓
Trip Settled
```

There is no Vehicle Owner payable for an Own Fleet Trip.

---

# 7. Own Fleet Vehicle State Workflow

Own Fleet vehicles use the following states:

- Available
- In Trip
- Under Maintenance
- Sold / Removed

## Available → In Trip

Automatically occurs when an active Own Fleet Trip is assigned.

## In Trip → Available

Occurs when the active trip is completed and no maintenance state applies.

## Available → Under Maintenance

Owner can set the vehicle under maintenance when there is no active Trip.

## Under Maintenance → Available

Owner can return the vehicle to Available after maintenance.

## Available → Sold / Removed

Owner can permanently remove the vehicle from active fleet use.

Historical records remain accessible.

---

# 8. Market Vehicle Workflow

Market Vehicles do not have a vehicle-status workflow.

A Market Vehicle is:

- Stored in the Market Vehicle Master.
- Linked to a Vehicle Owner.
- Assigned to Trips when required.

No Available/In Trip/Maintenance state is maintained for Market Vehicles.

---

# 9. Vehicle Owner Workflow

A Vehicle Owner can be created:

- Directly through Vehicle Owner Master.
- Through Trip quick-create.

Quick-created records may initially be incomplete.

The workflow is:

```text
Vehicle Owner Identified
        ↓
Create / Select Vehicle Owner
        ↓
Link Market Vehicle(s)
        ↓
Use in Market Trips
        ↓
Track Payable
        ↓
Record Payments through Payment Module
```

Staff can create/edit Vehicle Owner records.

Staff cannot delete Vehicle Owner master records.

---

# 10. Party / Company Quick-Create Workflow

A Party/Company can be created:

- Directly through Party/Company Master.
- During Trip creation.

Quick-created records may initially contain incomplete information.

The user can later complete the approved Party Master fields.

---

# 11. Destination Workflow

A Trip may have multiple destinations.

The workflow is:

```text
Create Trip
    ↓
Add Destination 1
    ↓
Add Destination 2
    ↓
...
    ↓
Add Destination N
```

Each destination can contain:

- Destination.
- City.
- State.
- Unloading Date.
- Party-side Unloading Charge.
- Vehicle-owner Unloading Charge where applicable.
- Own-fleet Unloading Expense where applicable.

Destination sequence must be preserved. Destination identity is persistent. Existing destinations are edited in place. Removal is rejected when linked financial records exist.

---

# 12. Trip Completion Workflow

A Trip becomes Completed after unloading.

The basic transition is:

```text
Active / In Progress
        ↓
Unloading Completed
        ↓
Trip Status = Completed
```

Completed does not mean Settled.

The system must preserve:

`Completed != Settled`

---

# 13. POD Workflow

POD processing begins after Trip completion.

Workflow:

```text
Trip Completed
        ↓
POD Document Received
        ↓
Upload POD
        ↓
POD Received Timestamp Recorded
        ↓
POD Status Updated
```

The POD upload timestamp is the POD Received Date/Time.

Multiple POD files can be uploaded for the same Trip.

---

# 14. Courier Workflow

Courier information becomes applicable after POD receipt.

Workflow:

```text
POD Received
        ↓
Courier Docket Number Entered
        ↓
Courier Envelope Uploaded
        ↓
Courier Sent Action
        ↓
Courier Sent Timestamp Recorded
        ↓
POD Sent to Party
```

The application does not require a formal follow-up workflow after the POD is sent.

For Market Trips, SRL can communicate with the Party by phone regarding the sent POD and balance payment.

---

# 15. Issue Workflow

Issues are operational records.

Supported issue types include:

- Shortage.
- Damage.

Workflow:

```text
Issue Identified
        ↓
Create Issue
        ↓
Enter Issue Details
        ↓
Add Supporting Documents if Required
        ↓
Issue Remains Open
        ↓
Resolution / Closure
        ↓
Issue Closed
```

An Issue does not automatically create a financial deduction.

A separate financial adjustment is required for an actual deduction.

---

# 16. Financial Adjustment Workflow

A shortage or damage issue can later result in a financial deduction.

The distinction is:

```text
Operational Issue
       ≠
Financial Deduction
```

If a deduction is applicable:

```text
Issue
  ↓
Financial Deduction Entered
  ↓
Receivable / Payable Recalculated
  ↓
Settlement Recalculated
  ↓
Trip P&L Recalculated
```

---

# 17. Party Receivable Workflow

The Party/Company receivable is calculated from the applicable Trip financial information.

Components may include:

- Freight.
- Unloading Charges.
- Detention.
- Other Charges.
- Shortage/Damage Deductions.
- TDS.

Actual money received is recorded only through the Payment Module.

The workflow is:

```text
Trip Financial Obligation
        ↓
Party Receivable Calculated
        ↓
Payment Received
        ↓
Payment Module Allocation
        ↓
Amount Accounted Updated
        ↓
Outstanding Recalculated
        ↓
Settlement Recalculated
```

---

# 18. Vehicle Owner Payable Workflow

Applicable to Market Vehicle Trips.

Workflow:

```text
Trip Payable Calculated
        ↓
Vehicle Owner Payable
        ↓
Outgoing Payment Created
        ↓
Payment Module Allocation
        ↓
Amount Paid Updated
        ↓
Outstanding Payable Recalculated
        ↓
Settlement Recalculated
```

Actual money paid is stored only in the Payment Module.

---

# 19. Own Fleet Expense Workflow

Own Fleet expenses are associated with Own Fleet Trips.

Supported categories:

- Diesel.
- FASTag.
- Loading.
- Unloading.
- Border.
- Other.

The workflow is:

```text
Own Fleet Expense Identified
        ↓
Expense Recorded
        ↓
Actual Payment Recorded through Payment Module
        ↓
Trip Expense Updated
        ↓
Trip P&L Recalculated
```

Own Fleet expenses do not create Vehicle Owner payable.

---

# 20. Own Fleet Expense After Settlement

An Own Fleet Trip may receive additional expenses after it is Settled.

Workflow:

```text
Trip Settled
        ↓
New Own Fleet Expense Identified
        ↓
Warning / Confirmation
        ↓
Expense Recorded
        ↓
Payment Recorded
        ↓
Trip P&L Recalculated
```

The Trip remains Settled.

Adding a later Own Fleet expense does not change the Trip back to Unsettled.

---

# 21. Payment Creation Workflow

All actual money movement must use the Payment Module.

General workflow:

```text
Actual Money Movement
        ↓
Open Payment Module
        ↓
Select Payment Type
        ↓
Select Category
        ↓
Select Entity where applicable
        ↓
Enter Amount
        ↓
Enter Actual Payment Date
        ↓
Select Payment Mode
        ↓
Add Attachment if applicable
        ↓
Save Payment
        ↓
Create Allocation
        ↓
Update Related Records
```

---

# 22. Incoming Company Payment Workflow

```text
Company Pays SRL
        ↓
Create Incoming Payment
        ↓
Select Company
        ↓
Choose:
  - Specific Bill
  - Specific Trip
  - Bulk / FIFO
        ↓
Allocate Full Payment Amount
        ↓
Update Receivable
        ↓
Update Bill/Trip Position
        ↓
Generate Credit if Excess
```

Company payments can create Company credit.

---

# 23. Incoming Market Party Payment Workflow

```text
Market Party Pays SRL
        ↓
Create Incoming Payment
        ↓
Select Market Party
        ↓
Choose:
  - Specific Trip
  - Bulk / FIFO
        ↓
Allocate Full Payment Amount
        ↓
Update Trip Receivable
        ↓
Generate Credit if Excess
```

Market Party credit can be used against future receivables.

---

# 24. Other Business Receipt Workflow

```text
Other Business Receipt
        ↓
Create Incoming Payment
        ↓
Enter Category / Name
        ↓
Enter Amount
        ↓
Enter Date
        ↓
Select Payment Mode
        ↓
Enter Mandatory Remark
        ↓
Optional Attachment
        ↓
Save
```

Other Business Receipts are standalone incoming payments.

---

# 25. Vehicle Owner Payment Workflow

```text
Vehicle Owner Payable Exists
        ↓
Create Outgoing Payment
        ↓
Select Vehicle Owner
        ↓
Select Applicable Trip / Payable
        ↓
Enter Amount
        ↓
Select Payment Mode
        ↓
Save Payment
        ↓
Allocation Recorded
        ↓
Trip Payable Updated
        ↓
Settlement Recalculated
```

Vehicle Owner payments do not generate Vehicle Owner credit.

---

# 26. Other Business Payment Workflow

```text
Other Business Payment
        ↓
Create Outgoing Payment
        ↓
Enter Category / Name
        ↓
Enter Amount
        ↓
Enter Date
        ↓
Select Payment Mode
        ↓
Enter Mandatory Remark
        ↓
Optional Attachment
        ↓
Save
```

Other Business Payments reduce overall Payment Module P&L.

---

# 27. Payment Allocation Workflow

A payment must be fully accounted for.

For Party/Company incoming payments:

```text
Payment
   ↓
Specific Bill / Specific Trip / FIFO
   ↓
Receivable Allocation
   ↓
If Excess → Credit
   ↓
Total Accounted = Payment Amount
```

A completed Payment cannot remain partially unallocated.

---

# 28. FIFO Workflow

Only Owner can create FIFO bulk/unallocated allocations.

Workflow:

```text
Incoming Bulk Payment
        ↓
Owner Starts FIFO Allocation
        ↓
Identify Eligible Outstanding Receivables
        ↓
Apply Payment According to FIFO
        ↓
Continue Until Payment Fully Accounted
        ↓
Excess Amount → Party/Company Credit
        ↓
Save Allocation History
```

FIFO allocation must remain auditable.

---

# 29. Payment Reallocation Workflow

Only Owner can reallocate a completed Payment.

Workflow:

```text
Existing Active Payment
        ↓
Owner Opens Reallocation
        ↓
Show Current Allocation
        ↓
Warning / Confirmation
        ↓
Select New Allocation
        ↓
Fully Account for Payment
        ↓
Save Reallocation
        ↓
Recalculate Affected Records
        ↓
Create Audit Entry
```

The Payment ID remains unchanged.

---

# 30. Payment Edit Workflow

Authorized users can edit permitted Payment information.

Workflow:

```text
Payment Details
        ↓
Edit
        ↓
Change Permitted Fields
        ↓
Validate
        ↓
Save
        ↓
Preserve Previous Values
        ↓
Record New Values
        ↓
Create Audit Entry
        ↓
Recalculate if Required
```

The Payment ID remains unchanged.

---

# 31. Payment Reversal Workflow

Only Owner can reverse a Payment.

Workflow:

```text
Active Payment
        ↓
Owner Selects Reverse
        ↓
Display Reversal Warning
        ↓
Enter Mandatory Reason
        ↓
Confirm
        ↓
Payment Status → Reversed
        ↓
Reverse Allocations
        ↓
Recalculate Outstanding
        ↓
Recalculate Credit
        ↓
Recalculate Settlement
        ↓
Recalculate Bill Status
        ↓
Recalculate Financial Reports
        ↓
Create Audit Entry
```

The original Payment remains in history.

---

# 32. Credit Generation Workflow

Credit is created when a Party/Company payment exceeds the applicable receivable.

Workflow:

```text
Incoming Payment
        ↓
Apply to Eligible Receivables
        ↓
Receivables Fully Accounted
        ↓
Payment Amount Still Remaining
        ↓
Create Party/Company Credit
        ↓
Store Credit Source Payment
```

Credit must remain traceable to its source Payment.

---

# 33. Credit Utilization Workflow

```text
Existing Party/Company Credit
        ↓
Future Receivable Created
        ↓
Credit Available
        ↓
Apply Credit
        ↓
Credit Remaining Recalculated
        ↓
Future Outstanding Recalculated
```

Credit utilization does not create another Payment.

---

# 34. Bill Eligibility Workflow

A Company Trip becomes eligible for billing when:

- Trip is Completed.
- POD is Received.
- Trip is Unbilled.
- Required billing information exists.
- Trip is not Cancelled.

Workflow:

```text
Trip Completed
        ↓
POD Received
        ↓
Required Billing Data Validated
        ↓
Trip Appears in Unbilled / Billing-Eligible List
```

---

# 35. Individual Bill Workflow

```text
Billing-Eligible Trip
        ↓
Select Company
        ↓
Select Individual Billing
        ↓
Select One Trip
        ↓
Select Numbering Series
        ↓
Validate Required Fields
        ↓
Preview
        ↓
Generate Bill
        ↓
Create Bill Version
        ↓
Trip → Billed
        ↓
Bill Status = Generated
```

---

# 36. Consolidated Bill Workflow

```text
Billing-Eligible Trips
        ↓
Select Company
        ↓
Select Consolidated Billing
        ↓
Manually Select Multiple Trips
        ↓
Select Numbering Series
        ↓
Validate Required Fields
        ↓
Preview
        ↓
Generate Bill
        ↓
Create Bill Version
        ↓
Selected Trips → Billed
        ↓
Bill Status = Generated
```

The system must not automatically select all outstanding Trips.

---

# 37. Bill Submission Workflow

```text
Generated Bill
        ↓
User Submits / Sends Bill
        ↓
Bill Status → Submitted
        ↓
Submission History Recorded
```

Submission does not mean payment has been received.

---

# 38. Bill Payment Workflow

```text
Bill Submitted / Generated
        ↓
Company Payment Received
        ↓
Payment Created
        ↓
Payment Allocated to Bill
        ↓
Bill Accounted Amount Updated
        ↓
Outstanding Recalculated
        ↓
If Fully Accounted:
    Bill → Paid
```

If the payment is only partial, the Bill remains Generated or Submitted.

---

# 39. Bill Version Workflow

A Bill correction creates a new version.

Workflow:

```text
Current Bill Version
        ↓
Correction Required
        ↓
Create New Version
        ↓
Apply Corrected Data
        ↓
Generate New Bill Document
        ↓
New Version → Current
        ↓
Previous Version → Read-only
```

The Bill Number does not change.

---

# 40. Bill Cancellation Workflow

```text
Active Bill
        ↓
Authorized User Selects Cancel
        ↓
Enter Mandatory Reason
        ↓
Confirm Cancellation
        ↓
Bill Status → Cancelled
        ↓
Record Cancellation Metadata
        ↓
Associated Trips → Unbilled
        ↓
Active Bill Document Removed
        ↓
New Bill Can Be Generated
```

Cancelled Bills cannot be restored.

Cancelled Bill numbers cannot be reused.

---

# 41. Bill PDF Workflow

Generated Bill PDFs are stored by default.

Workflow:

```text
Bill Version
      +
Structured Template
      +
Business Data
      ↓
Render Bill
      ↓
Generate PDF
      ↓
Store PDF
      ↓
Make Available from Bill Details
```

If the Owner deletes the PDF:

```text
Stored PDF
   ↓
Owner Deletes PDF
   ↓
Structured Bill Remains
   ↓
PDF Can Be Regenerated
```

---

# 42. Bill Designer Workflow

The Bill Designer workflow is:

```text
Create / Import Template
        ↓
Automatic Reconstruction if Imported
        ↓
Review
        ↓
Correct Elements
        ↓
Configure Dynamic Fields
        ↓
Configure Tables / Repeatable Rows
        ↓
Add Assets
        ↓
Preview
        ↓
Validate
        ↓
Save Structured Template
        ↓
Assign to Company
```

Only Owner can modify production billing templates.

---

# 43. Bill Template Change Workflow

When the Owner changes the configured Company template:

```text
Existing Template
        ↓
Owner Changes Template
        ↓
New Template Becomes Current
        ↓
Future Bills Use New Template
        ↓
Existing Bills Remain Unchanged
```

Historical Bill Versions must retain their applicable template reference where required.

---

# 44. Required Billing Field Workflow

Before Bill generation:

```text
Selected Trips
        ↓
Load Company Billing Configuration
        ↓
Load Required Fields
        ↓
Validate Data
        ↓
If Complete → Continue
If Missing → Block Generation
```

The user must be told which required information is missing.

---

# 45. Trip Settlement Workflow

## Market Trip

```text
Trip Completed
        ↓
Party Receivable Accounted
        +
Vehicle Owner Payable Accounted
        ↓
Both Sides Settled
        ↓
Trip → Settled
```

## Own Fleet Trip

```text
Trip Completed
        ↓
Party Receivable Accounted
        ↓
Trip → Settled
```

Completed alone does not make a Trip Settled.

---

# 46. Settlement Recalculation Workflow

Settlement must be recalculated when relevant financial records change.

Triggers include:

- Payment creation.
- Payment edit.
- Payment reallocation.
- Payment reversal.
- Financial deduction changes.
- Applicable receivable/payable changes.

Workflow:

```text
Financial Change
      ↓
Recalculate Obligation
      ↓
Recalculate Amount Accounted
      ↓
Recalculate Outstanding
      ↓
Recalculate Settlement
```

---

# 47. Trip P&L Workflow

## Market Trip

```text
Net Party Receivable
        -
Net Vehicle Owner Payable
        =
Trip P&L
```

## Own Fleet Trip

```text
Net Party Receivable
        -
Own Fleet Expenses
        =
Trip P&L
```

Own Fleet expenses added after settlement can recalculate P&L without changing the Trip's Settled status.

---

# 48. Overall Business P&L Workflow

Overall business P&L is derived only from the Payment Module.

```text
Active Incoming Payments
        -
Active Outgoing Payments
        =
Business P&L
```

Incoming:

- Company Payments.
- Market Party Payments.
- Other Business Receipts.

Outgoing:

- Vehicle Owner Payments.
- Own Fleet Expenses.
- Other Business Payments.

Reversed Payments are excluded.

---

# 49. Financial Report Workflow

```text
Payment Records
        ↓
Apply Active/ Reversed Rule
        ↓
Apply Selected Filters
        ↓
Aggregate Payments
        ↓
Generate Financial Report
```

Filters include:

- Financial Year.
- Date Range.
- Type.
- Category.
- Entity.
- Payment Mode.

Financial reports must not be generated from a separate manually maintained financial ledger.

---

# 50. Financial Year Workflow

Financial-year reporting uses the Payment Module.

Workflow:

```text
Payment Records
        ↓
Determine Financial Year
        ↓
Group Payments
        ↓
Calculate:
  - Incoming
  - Outgoing
  - Net P&L
  - Payment Count
  - Category Totals
  - Monthly Breakdown
        ↓
Financial Year Report
```

Historical Financial Years remain accessible.

---

# 51. TDS Reporting Workflow

```text
Trip / Party TDS Data
        ↓
TDS Records
        ↓
Link Relevant Payment Information
        ↓
Group by Financial Year
        ↓
Generate TDS Report
```

TDS is not itself a Payment record.

---

# 52. Document Upload Workflow

For supported document types:

```text
Open Related Record
        ↓
Select Document Type
        ↓
Select File
        ↓
Upload
        ↓
Store File Reference + Metadata
        ↓
Associate with Record
```

Multiple files per document type are supported.

---

# 53. Document Permission Workflow

## Owner

Can:

- Upload.
- Replace.
- Delete.

## Staff

Can:

- Upload.
- View.

Cannot:

- Replace.
- Delete.

## CA

No document-management workflow.

---

# 54. Own Fleet Document Replacement Workflow

When a new Own Fleet document of the same type is uploaded:

```text
New Document Uploaded
        ↓
Existing Same-Type Document Identified
        ↓
New Document Becomes Active
        ↓
Old Document Becomes Inactive
        ↓
Old File Deleted
        ↓
Historical Metadata Retained
```

Historical metadata includes:

- Document Type.
- Document Number.
- Old Expiry Date.
- Replacement Date.
- Replaced By.

---

# 55. Generated Bill Document Deletion Workflow

Owner can delete stored generated Bill PDFs.

Workflow:

```text
Generated Bill PDF
        ↓
Owner Deletes PDF
        ↓
PDF Removed from Active Storage
        ↓
Bill + Bill Version Remain
        ↓
Structured Data Remains
        ↓
PDF Can Be Regenerated
```

---

# 56. Global Search Workflow

```text
User Enters Search
        ↓
Search Approved Identifiers
        ↓
Categorize Results
        ↓
Display:
  - Trips
  - Parties / Companies
  - Vehicles
  - Vehicle Owners
  - Bills
  - Payments
  - Documents
        ↓
User Opens Result
        ↓
Navigate to Source Record
```

Search context must be preserved when navigating back.

---

# 57. Audit Workflow

Important actions must generate audit history.

General workflow:

```text
Authorized Action
        ↓
Perform Action
        ↓
Save Business Change
        ↓
Create Audit Record
        ↓
Store User + Role + Time + Action
        ↓
Store Before/After Values where applicable
```

Payment audit history remains associated with the Payment Module.

---

# 58. Role-Based Workflow Enforcement

The UI and backend must enforce role permissions.

## Owner

Full workflow access.

## Staff

Operational workflows plus approved Payment/Billing workflows.

Staff cannot:

- Reverse payments.
- Reallocate completed payments.
- Create FIFO bulk/unallocated payments.
- Modify billing configuration.
- Manage users.
- Modify system settings.
- Delete documents.

## CA

Financial/tax read-only workflow.

CA cannot:

- Create/edit Payments.
- Generate/edit Bills.
- Perform operational Trip workflows.
- Manage documents.
- Manage users.
- Modify masters.

---

# 59. Cross-Module Synchronization

The following relationships must remain synchronized:

## Trip ↔ Payment

Payment changes update:

- Amount Accounted.
- Outstanding.
- Settlement.
- Related financial position.

## Bill ↔ Payment

Payment changes update:

- Accounted Amount.
- Outstanding.
- Paid status.

## Bill ↔ Trip

Bill generation updates:

- Trip Billing State.

Bill cancellation updates:

- Trip back to Unbilled.

## Trip ↔ Own Fleet Expense

Expense changes update:

- Trip Expenses.
- Trip P&L.

## Party / Company ↔ Payment

Payment changes update:

- Outstanding.
- Credit.
- Payment history.

---

# 60. Workflow Failure Handling

If a multi-step operation fails, the system must avoid leaving related records in a partially updated state.

Examples:

- Bill generation must not mark Trips as Billed if Bill creation fails.
- Payment allocation must not update only the Trip while failing to save the Allocation.
- Payment reversal must not change Payment status without reversing its financial effects.
- Bill cancellation must not release Trips if cancellation itself fails.

Transactions or equivalent consistency mechanisms must be used for critical multi-record operations.

---

# 61. Non-Negotiable Workflow Rules

1. Actual money movement is recorded only through the Payment Module.
2. Completed and Settled are distinct states.
3. Company billing requires Completed + POD Received + Unbilled Trip.
4. Billing before POD is prohibited.
5. Individual Bills contain one Trip.
6. Consolidated Bills contain manually selected multiple Trips.
7. A Trip cannot belong to multiple active Bills.
8. Bill statuses are only Generated, Submitted, Paid, and Cancelled.
9. There is no Partially Paid Bill status.
10. Paid status is derived from active Payment allocations.
11. Bill corrections create new versions, not new Bill Numbers.
12. Cancelled Bill numbers are never reused.
13. Cancelled Bills cannot be restored.
14. Cancelled Bills release their Trips back to Unbilled.
15. Company credit is created from excess incoming payments.
16. Vehicle Owner credit is not supported.
17. Completed Payments cannot remain partially allocated.
18. Only Owner can reverse Payments.
19. Only Owner can reallocate completed Payments.
20. Only Owner can create FIFO bulk/unallocated Payment allocations.
21. Payment reversal recalculates all affected financial positions.
22. Payment-based financial reports use only active Payment records.
23. Reversed Payments are excluded from financial totals.
24. Own Fleet expenses can be added after settlement after warning, without changing Settled status.
25. Bill Designer templates are structured and support repeatable consolidated rows.
26. Critical cross-module workflows must maintain transactional consistency.
