# UI/UX Specification

## 1. Purpose

This document defines the UI/UX requirements for the Shri Sanwariya Road Lines (SRL) application.

The interface must support:

- Fast day-to-day transport operations.
- Clear financial visibility.
- Efficient trip management.
- Billing workflows.
- Payment workflows.
- Document handling.
- Role-aware access.
- Desktop and mobile usability.
- Clear navigation between related records.

The UI must reflect the approved business logic and must not introduce unsupported workflows.

---

# 2. Design Principles

The application UI should follow these principles:

1. Operational information must be easy to find.
2. Financial information must be clearly separated from operational information.
3. Important actions must be explicit.
4. Destructive or financially significant actions must require confirmation.
5. Related records must be directly accessible.
6. Lists must support efficient search and filtering.
7. Detail pages must contain complete information without unnecessary duplication.
8. Role-based access must be reflected in the interface.
9. Desktop and mobile layouts must both be usable.
10. The UI must not expose controls that the current user cannot perform.
11. Financial totals must clearly distinguish calculated obligations from actual payments.
12. Historical information must remain accessible.

---

# 3. Application Navigation

The primary navigation uses grouped sidebar navigation.

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

Role-based access determines which navigation items are visible.

---

# 4. Responsive Navigation

## Desktop

Use a persistent sidebar for primary navigation.

The sidebar should clearly separate:

- Operations.
- Finance.
- Documents.
- Configuration.

## Mobile

Use a compact navigation pattern appropriate for smaller screens.

The interface must prioritize:

- Primary operations.
- Search.
- Current record context.
- Important actions.

Mobile navigation must not attempt to display the full desktop sidebar simultaneously.

---

# 5. Global Header

The global application header should provide access to common system functionality.

Where applicable, it should contain:

- Global Search.
- Current user information.
- Role/context information.
- Account actions.

The header must remain visually consistent across application modules.

---

# 6. Global Search

Global Search must search across approved identifiers and entities.

Searchable information includes:

- Trip Number.
- Vehicle Number.
- Party / Company Name.
- Vehicle Owner Name.
- Mobile Numbers.
- Bill Number.
- Payment ID.
- LR Number.
- Invoice Number.
- Courier Docket Number.
- Relevant document information.

Results must be categorized.

## Result Categories

- Trips
- Parties / Companies
- Vehicles
- Vehicle Owners
- Bills
- Payments
- Documents

Selecting a result opens the source record.

---

# 7. Navigation Context Preservation

Navigation between related records must preserve user context where practical.

Example:

```text
Payment List
    ↓
Payment Details
    ↓
Trip Details
    ↓
Party Details
```

If the user goes back, the application should return to the immediate previous context.

It should preserve, where practical:

- Search query.
- Filters.
- Pagination.
- Scroll position.
- Selected tab.

Global Search results should similarly preserve the original search context.

Browser Back should follow logical application navigation rather than unexpectedly returning to a generic list.

---

# 8. Dashboard

The Dashboard must be role-aware.

The Owner dashboard can provide the complete business snapshot.

Staff receives information relevant to daily operational work and permitted financial/billing work.

CA receives financial/tax-oriented information.

---

# 9. Dashboard Sections

The approved dashboard sections are:

## Personalized Header

- User name.
- Current date.

## Business Snapshot

- Trips.
- Receivable.
- Payable.
- Profit/Loss.

## Needs Attention

- POD Pending.
- Unsettled Trips.
- Bills.
- Issues.
- Expiring Documents.

## Financial Position

- Company Outstanding.
- Market Outstanding.
- Vehicle Owner Payable.
- Credits.

## Trip Activity

Recent/current operational activity.

## Own Fleet Monthly Performance

Own-fleet performance information.

## Recent Payments

Recent Payment Module activity.

---

# 10. Dashboard Interactions

Dashboard numbers should be clickable where the corresponding filtered record list exists.

Example:

```text
POD Pending
    ↓
Trips filtered to POD Pending
```

Similarly:

- Unsettled Trips → Unsettled Trips.
- Recent Payments → Payment list/context.
- Outstanding → relevant financial record list.

The dashboard should not create duplicate financial data sources.

---

# 11. Trips List

The Trips List is a primary operational screen.

It must provide:

- Search.
- Filters.
- Status tabs.
- Table/Card toggle on desktop.
- Compact cards on mobile.

---

# 12. Trip Tabs

The following tabs must be available:

- All Trips
- Active/In Progress
- Completed
- Unsettled
- Settled
- Cancelled
- Issues
- POD Pending
- Unbilled

Each tab must show a live count.

Counts must update automatically when underlying records change.

Filters can further narrow the selected tab.

---

# 13. Trip List View Modes

Desktop supports:

- Table View.
- Card View.

The user can switch between the two.

Mobile uses compact cards only.

---

# 14. Trip List Fields

The Trip List must show only:

1. Trip Number
2. Vehicle Number
3. Driver Mobile Number
4. Origin
   - Origin Location
   - Origin City/State
5. Destination
   - Destination Location
   - Destination City/State
6. Trip Status
7. Loading Date
8. Unloading Date

Additional Trip information belongs in Trip Details.

---

# 15. Trip Details

Trip Details must provide complete structured Trip information.

The page should be divided into logical sections.

## Sections

1. Trip Overview
2. Party / Company
3. Vehicle Owner
4. Journey & Destinations
5. Party / Company Receivables
6. Vehicle Owner Payables
7. Own Fleet Expenses
8. POD & Courier
9. Issues
10. Billing
11. Payment History
12. Settlement
13. Profit/Loss
14. Documents
15. Activity / Audit History

---

# 16. Trip Overview UI

Display:

- Trip Number.
- Trip Type.
- Vehicle Relationship.
- Trip Status.
- Party / Company Name.
- Party / Company Mobile.
- Vehicle Number.
- Driver Mobile.
- Vehicle Owner Name where applicable.
- Vehicle Owner Mobile where applicable.
- Origin.
- Loading Date.
- Unloading Date.

Master information should not be unnecessarily duplicated.

---

# 17. Party / Company Section

Trip Details should show:

- Party / Company Name.
- Mobile Number.

The complete Party Master information should remain in the Party / Company record.

The Trip should provide a direct link to the Party / Company record.

---

# 18. Vehicle Owner Section

For Market Trips, display:

- Vehicle Owner Name.
- Mobile Number.

The complete Vehicle Owner Master information remains in the Vehicle Owner record.

The Trip should provide a direct link to the Vehicle Owner record.

This section does not appear as an applicable financial section for Own Fleet Trips.

---

# 19. Journey & Destinations

The Journey section must support multiple destinations.

Each destination should display:

- Destination.
- City.
- State.
- Unloading Date.
- Party-side Unloading Charge.
- Vehicle-owner Unloading Charge where applicable.
- Own-fleet Unloading Expense where applicable.

Destinations must remain ordered.

---

# 20. Party / Company Receivables UI

Display:

- Freight.
- Advance/payment allocations.
- Balance.
- Unloading Charges.
- Detention.
- Other Charges.
- Shortage/Damage Deductions.
- TDS.
- Total Receivable.
- Amount Accounted/Received.
- Outstanding.
- Credit allocation where applicable.

Actual payment information should link to the Payment Module.

---

# 21. Vehicle Owner Payable UI

For Market Vehicle Trips, display:

- Vehicle Owner.
- Base Freight.
- Advance/payment allocations.
- Balance Payable.
- Detention.
- Unloading Charges.
- Other Charges.
- Shortage/Damage Deductions.
- Total Payable.
- Amount Paid.
- Outstanding Payable.

Actual outgoing payments must link to the Payment Module.

---

# 22. Own Fleet Expense UI

For Own Fleet Trips, display:

- Diesel Entries.
- FASTag Entries.
- Loading.
- Unloading.
- Border.
- Other.
- Total Expenses.
- Expense Payment Records.

Do not show Trip P&L inside this section.

Trip P&L belongs in its own dedicated section.

---

# 23. POD & Courier UI

The POD and Courier section must display:

- POD Status.
- POD Files.
- POD Received Date/Time.
- Uploaded By.
- LR Information.
- Invoice Information.
- Courier Docket Number.
- Courier Envelope File.
- Courier Sent Status.
- Courier Sent Date/Time.

Multiple POD files must be supported.

---

# 24. Issues UI

Issues may include:

- Shortage.
- Damage.

Display:

- Issue Type.
- Issue Details.
- Status.
- Resolution/Closure.
- Supporting Documents.

The interface must clearly distinguish an operational Issue from a financial Deduction.

---

# 25. Billing UI in Trip Details

Display:

- Billing Status.
- Bill Number.
- Bill Version.
- Current/Previous Version relationship.
- Bill Date.
- Billing Mode.
- Included Bill information.
- Generated Bill document.
- Bill-related Payment links.

Selecting a Bill should open Bill Details.

---

# 26. Payment History in Trip Details

Display actual linked Payment records.

Fields include:

- Payment ID.
- Date.
- Type/Category.
- Amount.
- Mode.
- Allocation.
- Status.

Each Payment should link to the authoritative Payment Details record.

---

# 27. Settlement UI

Display settlement separately for:

## Party Side

Whether the Party/Company obligation is settled.

## Vehicle Owner Side

Whether the Vehicle Owner payable is settled.

## Overall Trip

Whether the complete applicable Trip is Settled.

For Own Fleet Trips:

- Party-side settlement determines Trip settlement.
- There is no Vehicle Owner settlement side.

The interface must clearly communicate:

`Completed != Settled`

---

# 28. Trip Profit/Loss UI

Trip P&L must have its own dedicated section.

## Market Trip

Display the relationship between:

- Net Party Receivable.
- Net Vehicle Owner Payable.
- Trip P&L.

## Own Fleet Trip

Display:

- Net Party Receivable.
- Own Fleet Expenses.
- Trip P&L.

Trip P&L must remain separate from the Payment Module's overall business P&L.

---

# 29. Trip Documents UI

Documents should be grouped by type.

Possible groups:

- POD.
- Courier Envelope.
- Issue Documents.
- Payment Attachments where linked.
- Other Trip Attachments.

Multiple files per type must be supported.

Each document should show appropriate metadata such as:

- Filename.
- Upload Date/Time.
- Uploaded By.
- File Size.

---

# 30. Activity / Audit UI

The Trip Activity section should show relevant Trip actions chronologically.

Financial Payment audit history remains authoritative within the Payment Module.

Where a Trip action references a Payment, the UI should provide a link to the Payment's audit history.

---

# 31. Party / Company List

The Party / Company List must show only:

- Party / Company Name.
- Mobile Number.
- Party Type.
- Current Outstanding.
- Current Credit.

The list must not display:

- GSTIN.
- TDS Applicable.

---

# 32. Party / Company List Controls

The list must support:

- Search.
- Combined filters.
- Desktop Table/Card toggle.
- Mobile compact cards.

The filters should be combinable.

---

# 33. Party / Company Details

Party / Company Details must provide:

- Complete Master information.
- Billing Configuration.
- Financial Position.
- Trips.
- Bills.
- Payments.
- TDS.
- Documents.

Related records must be clickable.

---

# 34. Party / Company Financial Position

Display separate sections for:

## Receivables

- Total Receivable.
- Amount Received.
- TDS.
- Deductions.
- Outstanding.

## Credit

- Current Credit.
- Generated.
- Utilized.
- Remaining.

## Payment Activity

- Incoming History.
- FIFO Allocations.
- Specific Trip Allocations.
- Specific Bill Allocations.

## Trip / Bill Position

- Total Trips.
- Unbilled Amount.
- Billed Amount.
- Outstanding Bills.
- Settled Bills.

---

# 35. Vehicle Owner UI

Vehicle Owner screens should provide:

- Owner Name.
- Mobile Number.
- Owned Market Vehicles.
- Related Trips.
- Related Payments.
- Financial position where applicable.

Vehicle Owner credit must not be displayed as a normal credit balance because Vehicle Owner credit is not supported.

---

# 36. Market Vehicle UI

Market Vehicle screens should provide:

- Vehicle Number.
- Vehicle Owner.
- Vehicle Owner Mobile.
- Related Trips.

Market Vehicles do not have a vehicle-status control.

---

# 37. Own Fleet UI

Own Fleet screens should clearly separate SRL-owned vehicles from Market Vehicles.

Display:

- Vehicle Number.
- Current State.
- Active Trip where applicable.
- Maintenance state where applicable.
- Historical records.

Allowed states:

- In Trip.
- Available.
- Under Maintenance.
- Sold / Removed.

---

# 38. Own Fleet State UI

### In Trip

Automatically derived from an active Own Fleet Trip.

### Available

Shown when:

- No active Trip exists.
- Vehicle is not under maintenance.

### Under Maintenance

Owner-controlled state.

The UI must prevent assigning a new Trip to a vehicle under maintenance.

### Sold / Removed

Permanent fleet departure state.

Historical records remain accessible.

---

# 39. Payment List

The Payment List must display only:

1. Payment ID
2. Date
3. Type
4. Entity
5. Category
6. Amount
7. Mode
8. Status

The list must support:

- Search.
- Combined filters.
- Financial Year filter.
- Date filter.
- Incoming/Outgoing filter.
- Entity filter.
- Category filter.
- Payment Mode filter.
- Status filter.
- Trip filter.
- Bill filter.

Desktop supports Table/Card toggle.

Mobile uses compact cards.

---

# 40. Payment Details

Payment Details should display:

## Basic

- Payment ID.
- Date.
- Type.
- Entity.
- Category.
- Amount.
- Mode.
- Status.

## User Information

- Created By.
- Created Date/Time.
- Last Edited By.
- Last Edited Date/Time.

## Relationships

- Trip.
- Bill.
- Party/Company.
- Vehicle Owner.
- Own Fleet.
- Other Business Category.

## Allocation

- Allocated Amount.
- Allocation Type.
- Trip/Bill.
- Allocation Date.
- Remaining Unallocated Amount.
- FIFO Details.
- Credit Generated.

## Additional

- Attachment.
- Audit History.
- Reversal Details.

---

# 41. Payment Actions

Actions must be role-aware.

Owner may have:

- Edit.
- Reverse.
- Reallocate.

Staff may have:

- Create.
- Edit.

CA has view-only access.

Financially significant actions must use explicit confirmation.

---

# 42. Payment Reversal UI

Reversal must be clearly distinguished from deletion.

The UI should show:

- Reversal warning.
- Mandatory reason field.
- Confirmation action.

After reversal, display:

- Reversed status.
- Reversed By.
- Reversal Date/Time.
- Reversal Reason.

The original Payment remains visible.

---

# 43. Payment Reallocation UI

Only Owner can reallocate a completed Payment.

The interface must show:

- Current allocations.
- Proposed allocations.
- Total Payment Amount.
- Remaining amount.
- Credit generated where applicable.

The completed result must fully account for the Payment amount.

A warning and confirmation are required.

---

# 44. Bill List

The Bill List should support:

- Search.
- Combined filters.
- Company filter.
- Bill Number filter.
- Financial Year filter.
- Bill Status filter.
- Billing Mode filter.
- Bill Date filter.
- Payment position filter.

Desktop supports:

- Table View.
- Card View.

Mobile uses compact cards.

---

# 45. Bill Details

Display:

## Basic

- Bill Number.
- Bill Version.
- Current/Previous Version.
- Bill Date.
- Company.
- Billing Mode.
- Status.

## Trips

- Included Trips.
- Trip Numbers.
- Trip amounts.
- Relevant billing information.

## Payments

- Related Payments.
- Allocations.
- Accounted Amount.
- Outstanding Amount.

## Documents

- Current Bill PDF.
- Previous version documents where retained.
- Regeneration action where permitted.

## Audit

- Creation history.
- Version history.
- Submission history.
- Cancellation history.
- Relevant changes.

---

# 46. Bill Status UI

Allowed statuses:

- Generated.
- Submitted.
- Paid.
- Cancelled.

Do not display:

- Draft.
- Partially Paid.

A partially paid Bill should show:

- Its actual accounted amount.
- Its outstanding amount.
- Status remains Generated or Submitted.

Paid is system-derived.

---

# 47. Bill Generation UI

The Bill generation workflow should guide the user through:

1. Select Company.
2. Load billing configuration.
3. Show eligible Completed + POD Received + Unbilled Trips.
4. Select Trips.
5. Select Numbering Series.
6. Validate required fields.
7. Preview Bill.
8. Generate Bill.
9. Show generated Bill.
10. Provide appropriate next actions.

For Individual Billing, exactly one Trip is selected.

For Consolidated Billing, multiple Trips may be selected.

---

# 48. Bill Cancellation UI

Cancellation must require:

- Confirmation.
- Mandatory cancellation reason.

After cancellation, show:

- Cancelled status.
- Cancellation reason.
- Cancelled By.
- Cancellation Date/Time.

The associated Trips return to Unbilled.

The Bill cannot be restored.

---

# 49. Bill Version UI

Bill Details should make the version relationship obvious.

Example:

```text
Bill: SRL/26-27/001

Current Version: v2

Versions:
v1 — Previous
v2 — Current
```

Previous versions must be read-only.

---

# 50. Bill Designer UI

The Bill Designer should provide:

- Template selection.
- Template creation.
- Existing Bill import.
- Automatic reconstruction.
- Editable canvas.
- Element controls.
- Dynamic field selection.
- Table editor.
- Repeatable section configuration.
- Asset management.
- Preview.
- Save.
- Template assignment.

Only Owner can modify production templates.

---

# 51. Financial Reports UI

Financial Reports are derived from the Payment Module.

The interface should provide:

## Payment Summary

- Total Incoming.
- Total Outgoing.
- Net P&L.
- Payment Count.
- Reversed Payment Count.

## Incoming

- Company Payments.
- Market Party Payments.
- Other Business Receipts.

## Outgoing

- Vehicle Owner Payments.
- Own Fleet Expenses.
- Other Business Payments.

---

# 52. Financial Report Filters

Support:

- Financial Year.
- Date Range.
- Type.
- Category.
- Entity.
- Payment Mode.

Only Active Payments contribute to financial totals.

Reversed payments remain visible historically but are excluded from totals.

---

# 53. Financial Year Records UI

Financial Year records should provide:

- Total Incoming.
- Total Outgoing.
- Net P&L.
- Payment Count.
- Category Totals.
- Monthly Breakdown.
- Underlying Payments.
- Reversed History.
- Export.

Historical Financial Years must remain accessible.

---

# 54. TDS Report UI

The TDS report should provide:

- Party/Company.
- Trip Number.
- TDS Amount.
- Related Payments.
- Financial Year.
- Date.
- Status/Position.

Filters:

- Financial Year.
- Party/Company.
- Date.
- Trip.

---

# 55. CA / Tax / ITR UI

The CA workspace should provide read-only access to:

- Payment-based income/receipts.
- Expenses.
- Payment-based P&L.
- Financial Year summaries.
- TDS.
- Reversed Payment history.
- Supporting Trip references.
- Supporting Bill references.
- Exports.

The CA interface must not expose operational editing controls.

---

# 56. Documents Module

The Documents module provides centralized document access.

Documents may also be accessible from their related records.

The UI should support:

- Search.
- Filtering.
- Document type.
- Related entity.
- Upload date.
- Uploaded By.

Multiple files per document type must be supported.

---

# 57. Document Permissions in UI

Owner:

- View.
- Upload.
- Replace.
- Delete.

Staff:

- View.
- Upload.

Staff cannot:

- Replace.
- Delete.

CA:

- No document-management controls.

Where documents are visible for financial context, CA should receive only the appropriate read access.

---

# 58. Document Metadata UI

Each document should show, where applicable:

- Document Type.
- Filename.
- Upload Date/Time.
- Uploaded By.
- File Size.
- Related Record.

The UI should distinguish active/current files from historical metadata where applicable.

---

# 59. Global Confirmation Rules

Confirmation must be used for high-impact actions, especially:

- Payment reversal.
- Payment reallocation.
- Bill cancellation.
- Permanent fleet removal.
- Document deletion.
- Other irreversible actions.

The confirmation must clearly state the consequence.

---

# 60. Empty States

Empty states should be contextual.

Examples:

```text
No trips found.
Try changing the filters or search term.
```

```text
No payments found.
No Payment records match the selected filters.
```

Empty states should not imply that data does not exist globally when filters are active.

---

# 61. Loading States

Loading states should clearly indicate that data is being retrieved or processed.

For large operations such as:

- Bill generation.
- PDF rendering.
- Template reconstruction.
- File upload.

the UI should show an appropriate progress/loading state.

The user must not be left uncertain whether the action was accepted.

---

# 62. Error States

Errors should:

- Explain what failed.
- Identify the affected action.
- Avoid exposing sensitive technical details.
- Provide a corrective action where possible.

For example:

```text
Bill generation could not be completed.
Required field "GSTIN" is missing for the selected Company.
```

---

# 63. Success Feedback

Successful actions should provide clear feedback.

Examples:

- Trip created.
- Payment created.
- Payment updated.
- Payment reversed.
- Bill generated.
- Bill version created.
- Bill submitted.
- Bill cancelled.
- Document uploaded.

Success feedback should not obscure the current record context.

---

# 64. Forms

Forms should be divided into logical sections rather than presenting every field as one long block.

Required fields must be clearly indicated.

Validation should occur before submission and on the backend.

The UI must not rely solely on client-side validation.

---

# 65. Search and Filters

Lists should provide search and filtering controls near the top of the page.

Combined filters must be supported where approved.

The UI should clearly show active filters.

Clearing filters should be easy.

No saved filter views are required.

---

# 66. Table and Card Views

Desktop modules that support both views should provide a clear Table/Card toggle.

Table View is appropriate for:

- Dense operational records.
- Financial records.
- Billing records.

Card View should preserve the same essential information in a more visual structure.

Mobile should use compact cards instead of forcing desktop tables onto small screens.

---

# 67. Record Links

Related records must be clickable.

Examples:

- Trip → Party.
- Trip → Vehicle Owner.
- Trip → Payment.
- Trip → Bill.
- Payment → Trip.
- Payment → Bill.
- Bill → Trip.
- Bill → Payment.
- Party → Trips.
- Party → Bills.
- Party → Payments.
- Vehicle Owner → Trips.
- Vehicle Owner → Payments.

The link should preserve navigation context.

---

# 68. Financial Information Presentation

The UI must distinguish between:

### Calculated Obligation

Examples:

- Receivable.
- Payable.
- Outstanding.
- Bill Amount.

### Actual Money Movement

Examples:

- Payment.
- Amount Received.
- Amount Paid.

### Adjustment

Examples:

- TDS.
- Deduction.
- Credit.

These concepts should not be visually presented as if they are the same type of record.

---

# 69. Settlement Presentation

Settlement should not be represented as equivalent to Trip completion.

The interface must communicate:

```text
Completed
≠
Settled
```

For Market Trips, both financial sides must be settled.

For Own Fleet Trips, Party-side settlement determines Trip settlement.

---

# 70. Role-Aware UI

The frontend must hide actions the current user cannot perform.

Examples:

Staff must not see:

- Payment Reverse.
- Payment Reallocate.
- FIFO Bulk Payment Creation.
- Billing Configuration editing.
- User Management.
- System Settings.
- Document Delete.

CA must not see:

- Operational editing.
- Payment creation/editing.
- Bill generation/editing.
- Document management.
- User management.

However, frontend visibility is not authorization. Backend authorization remains mandatory.

---

# 71. Mobile UX

Mobile screens must prioritize:

- Search.
- Record identification.
- Essential status.
- Primary actions.
- Financial totals.
- Related-record navigation.

Long detail pages should use clearly separated sections.

Tables should not be horizontally compressed to the point of becoming unusable.

---

# 72. Desktop UX

Desktop should make efficient use of available screen space.

Preferred patterns include:

- Persistent sidebar.
- Dense tables.
- Split sections where useful.
- Clear action areas.
- Detail pages with structured sections.

The interface should avoid unnecessary whitespace that reduces operational information density.

---

# 73. Accessibility

The UI should provide:

- Clear labels.
- Keyboard-accessible controls.
- Visible focus states.
- Sufficient contrast.
- Meaningful error messages.
- Non-color-only status communication.
- Accessible form validation.

Status must not be communicated only through color.

---

# 74. Performance UX

The UI should avoid unnecessary full-page reloads.

For large datasets:

- Use pagination or appropriate incremental loading.
- Avoid rendering excessive records simultaneously.
- Keep filter/search interactions responsive.
- Avoid blocking unrelated parts of the interface during local operations.

Bill rendering and template reconstruction may use asynchronous processing where required.

---

# 75. UI Data Integrity

The interface must reflect authoritative backend state.

Examples:

- A reversed Payment must immediately appear as Reversed.
- A Paid Bill must reflect active Payment allocations.
- A cancelled Bill must release its Trips.
- A Settled Trip must reflect applicable settlement state.
- A Sold/Removed vehicle must remain historically visible.

The frontend must not maintain conflicting financial state independently.

---

# 76. Non-Negotiable UI/UX Rules

1. Navigation must follow the approved module structure.
2. Role-based UI must match approved permissions.
3. Backend authorization remains mandatory.
4. Trip List must not display unapproved extra fields.
5. Trip Details must contain complete structured Trip information.
6. Payment List must use the approved fields.
7. Bill statuses must only be Generated, Submitted, Paid, and Cancelled.
8. There is no Partially Paid Bill status.
9. Paid Bill status must be system-derived.
10. Payment records must link to the authoritative Payment Module.
11. Financial reports must be payment-derived.
12. Completed and Settled must remain distinct.
13. Related records must be clickable.
14. Navigation context should be preserved.
15. Desktop Table/Card toggles must be supported where specified.
16. Mobile must use compact cards where specified.
17. Multiple documents per type must be supported.
18. High-impact actions require explicit confirmation.
19. Historical information must remain accessible.
20. The UI must not introduce business rules that are not defined in the approved requirements.
