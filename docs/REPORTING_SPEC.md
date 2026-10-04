# Reporting Specification

## 1. Purpose

The SRL Reporting module provides business and financial visibility from the application's operational and payment records.

A critical system rule is:

> **Financial Reports are created from the Payment Module because the Payment Module is the authoritative source for actual incoming and outgoing business payments.**

Operational records such as Trips and Bills may display their own calculated positions, but payment-based Financial Reports must use Payment Module records as their source.

---

## 2. Reporting Principles

1. Reports must use the application's stored business records.
2. Payment-based financial reports must derive actual money movement only from Payment Module records.
3. Reversed payments are excluded from active payment-based financial totals.
4. Reports must respect the selected Financial Year.
5. Reports must support historical multi-year records.
6. Report totals must be traceable to underlying records.
7. Clicking a report figure should open the relevant filtered records where practical.
8. Role permissions apply to report access.
9. Reports must not create or modify financial transactions.
10. Report generation must not create duplicate payment or accounting records.
11. The application provides business reporting; formal statutory accounting and tax filing remain the CA's responsibility.

---

## 3. Financial Reporting Source of Truth

### 3.1 Payment Module

The Payment Module is the source of truth for:

- Actual incoming payments
- Actual outgoing payments
- Payment dates
- Payment amounts
- Payment modes
- Payment categories
- Payment status
- Payment allocations
- Credits generated or utilized where applicable

### 3.2 Trip Module

Trip records provide operational/obligation information such as:

- Freight
- Detention
- Unloading charges
- Other charges
- Deductions
- TDS
- Market vehicle-owner payable obligations
- Own-fleet trip expense information

Trip-level calculations may be displayed inside Trip Details.

They must not be treated as replacements for actual Payment Module transactions.

### 3.3 Bill Module

Bills provide billing information such as:

- Bill number
- Bill amount
- Billing date
- Company/Party
- Included trips
- Bill status
- Bill version

Bill information can be used for bill-related reporting and reconciliation.

Actual money received remains sourced from Payment Module records.

---

## 4. Financial Report Access

The Financials / Reports area is available according to role permissions.

### Owner

Full financial-report access.

### Staff

Access to financial reports permitted by the Staff role.

Staff can view financial information but cannot use reporting screens to bypass payment permissions.

### CA

Read-only access to financial and tax-related reports relevant to CA work.

CA cannot modify underlying transactions through the reporting module.

---

## 5. Report Time Period

Reports must support Financial Year filtering.

The application must preserve historical records across financial years.

Users should be able to select the applicable Financial Year and, where the report supports it, further narrow the reporting period.

Possible date filtering includes:

- Financial Year
- Custom date range
- Month
- Specific date range

The exact available date controls can vary by report.

---

## 6. Overall Financial Position

The Financial Reports area should provide a high-level view of:

- Total Incoming Payments
- Total Outgoing Payments
- Net Business P&L
- Company-related incoming
- Market-party incoming
- Vehicle-owner outgoing
- Own-fleet outgoing
- Other Business Payments
- Other Business Receipts
- Payment counts
- Reversed payment amounts where useful for audit/reconciliation

Active totals exclude reversed payments.

---

## 7. Business P&L

The application's payment-based business P&L is:

```text
Active Incoming Payments
        −
Active Outgoing Payments
        =
Business P&L
```

### Incoming

Incoming payments include applicable active:

- Company receipts
- Market-party receipts
- Other Business Receipts

### Outgoing

Outgoing payments include applicable active:

- Vehicle-owner payments
- Own-fleet expenses
- Other Business Payments

### Reversed Payments

Reversed payments do not contribute to active P&L totals.

---

## 8. P&L Report

The P&L report should show, as applicable:

- Total incoming
- Total outgoing
- Net P&L
- Incoming by category
- Outgoing by category
- Incoming by payment mode
- Outgoing by payment mode
- Period comparison where supported by the selected date range

Every displayed total should be traceable to Payment Module records.

---

## 9. Incoming Payment Report

The Incoming Payment report should provide:

- Total incoming amount
- Number of incoming payments
- Incoming by entity
- Incoming by category
- Incoming by payment mode
- Incoming by date
- Incoming by Financial Year

Relevant entities include:

- Companies
- Market Parties
- Other Business Receipt categories

The report should allow the user to open the underlying filtered payment records.

---

## 10. Outgoing Payment Report

The Outgoing Payment report should provide:

- Total outgoing amount
- Number of outgoing payments
- Outgoing by entity
- Outgoing by category
- Outgoing by payment mode
- Outgoing by date
- Outgoing by Financial Year

Relevant entities include:

- Vehicle Owners
- Own Fleet
- Other Business Payment categories

The report should allow the user to open the underlying filtered payment records.

---

## 11. Payment Mode Report

Payment reporting may be grouped by:

- UPI
- Bank Transfer
- Cash

The report should show:

- Incoming amount by mode
- Outgoing amount by mode
- Net amount by mode where useful
- Payment count by mode

Reversed payments must not be included in active totals.

---

## 12. Company Financial Reporting

Company-related financial reporting may include:

- Incoming payments
- Total received
- Outstanding position
- Credit position
- Bill-related position
- Payment activity
- TDS information where available
- Allocations to bills/trips

Actual received amounts must come from Payment Module records.

Company outstanding/credit shown in master pages should remain synchronized with the underlying payment and receivable logic.

---

## 13. Market Party Financial Reporting

Market Party reporting may include:

- Total receivable position
- Actual incoming payments
- Outstanding amount
- Credit balance
- Trip-level receivable position
- Payment history
- Allocations
- TDS and deductions where applicable

Actual payment amounts must be sourced from Payment Module records.

---

## 14. Vehicle Owner Payable Reporting

Vehicle-owner reporting may include:

- Total payable obligations
- Actual outgoing payments
- Outstanding payable
- Payment history
- Trip-related payable position
- Payment allocations

Vehicle owners do not receive a credit balance.

Overpayment to a vehicle owner must not be carried forward as a vehicle-owner credit under the defined business rules.

---

## 15. Own Fleet Financial Reporting

Own-fleet reporting should support:

- Own-fleet incoming payments
- Own-fleet outgoing expenses
- Trip-level own-fleet P&L
- Expense categories
- Vehicle-level activity where supported
- Date/Financial Year filtering

Own-fleet expenses are actual outgoing payments recorded through the Payment Module.

Trip-level own-fleet P&L may use the trip's receivable calculation and associated own-fleet expenses.

---

## 16. Other Business Payment Reporting

Other Business Payments are standalone outgoing payment records.

Reports should support:

- Category/name
- Amount
- Date
- Payment mode
- Remark
- Attachment reference where applicable

These payments reduce payment-based business P&L.

---

## 17. Other Business Receipt Reporting

Other Business Receipts are standalone incoming payment records.

Reports should support:

- Category/name
- Amount
- Date
- Payment mode
- Remark
- Attachment reference where applicable

These receipts increase payment-based business P&L.

---

## 18. Credit Reporting

Credit balances are relevant for:

- Companies
- Market Parties

Reports may show:

- Credit generated
- Credit utilized
- Remaining credit
- Related payment
- FIFO utilization
- Related receivable/bill/trip

Credit reporting must be traceable to the underlying Payment Module allocation history.

Vehicle-owner overpayments are not treated as vehicle-owner credit.

---

## 19. Receivable Reporting

Receivable reporting may display the operational receivable position derived from trip/billing obligations and payment application.

It can include:

- Total receivable
- Amount received
- TDS
- Deductions
- Outstanding
- Unbilled amount
- Billed amount
- Credit

However:

> Actual money received must always be sourced from active Payment Module records.

---

## 20. Payable Reporting

Payable reporting may display:

- Vehicle-owner payable obligations
- Actual payments made
- Outstanding payable
- Trip-level payable position

Actual outgoing money must always be sourced from active Payment Module records.

---

## 21. Bill Reporting

The reporting area may provide bill-related information such as:

- Bills generated
- Bills submitted
- Bills paid
- Bills cancelled
- Bill amounts
- Outstanding bill amounts
- Bill activity by company
- Bill activity by Financial Year

Bill statuses are exactly:

- Generated
- Submitted
- Paid
- Cancelled

There is no Partially Paid bill status.

A bill with partial payment remains Generated or Submitted until its full bill amount is accounted for through active payment allocations.

---

## 22. Bill Payment Reconciliation

Bill-related reports should allow users to compare:

- Bill amount
- Payment allocated to the bill
- Remaining bill amount
- Bill status

Payment allocation is the basis for determining whether the bill has been fully paid.

If a payment is reversed, the bill's payment position and derived status must be recalculated.

---

## 23. TDS Reporting

TDS information should be available for permitted users.

Reports may include:

- Party/Company
- Trip
- Bill where applicable
- TDS amount
- Relevant date
- Financial Year
- Outstanding impact

TDS is an actual recorded financial adjustment and must not be inferred merely from a Party Master's TDS Applicable setting.

The Party Master setting indicates applicability; the actual TDS amount is recorded on the relevant financial record according to the business workflow.

---

## 24. Financial Year Reporting

The system must support historical reporting by Financial Year.

Example:

```text
FY 2026–27
FY 2027–28
FY 2028–29
```

Financial Year selection must affect applicable report calculations and filters.

Bill numbering resets by Financial Year, but historical bill numbers remain associated with their original Financial Year.

---

## 25. Trip Activity Reporting

Operational reporting may include:

- Total trips
- Completed trips
- Unsettled trips
- Settled trips
- Cancelled trips
- Trips by Party/Company
- Trips by Vehicle Owner
- Trips by vehicle
- Trips by route
- Trips by date
- POD pending trips
- Billing-eligible trips

Trip reports are operational reports and do not replace Payment Module financial reporting.

---

## 26. POD and Billing Readiness Reporting

Operational dashboards/reports may identify:

- Completed trips without POD
- Trips with POD received
- Trips awaiting courier action
- Trips with POD sent
- Completed trips eligible for billing
- Completed trips already billed
- Completed trips still unbilled

These reports help operations but do not create bills or payments automatically.

---

## 27. Document and Expiry Reporting

Document reporting may identify:

- Expiring own-fleet documents
- Documents already expired
- Document type
- Vehicle
- Expiry date
- Replacement status

The existing notification rule for own-fleet document expiry uses the defined expiry alert mechanism.

Document reporting must respect document permissions.

---

## 28. Report Filters

Reports should support relevant combinations of filters.

Common filters include:

- Financial Year
- Date range
- Month
- Incoming/Outgoing
- Payment category
- Entity
- Payment mode
- Payment status
- Trip
- Bill
- Party/Company
- Vehicle Owner
- Own Fleet

Filters should be combinable where the report logically supports them.

---

## 29. Search

Reports should support search where a textual identifier is useful.

Examples:

- Payment ID
- Bill number
- Trip number
- Party/Company name
- Vehicle Owner name
- Vehicle number

Search should narrow the displayed report records without changing the underlying transaction data.

---

## 30. Report Drill-Down

Report figures should be clickable where practical.

Example:

```text
Incoming Payments
₹12,50,000
      ↓
Filtered Payment List
      ↓
Payment Detail
```

Similarly:

```text
Vehicle Owner Payable
₹4,20,000
      ↓
Relevant payable/payment records
```

Drill-down must preserve the selected Financial Year and applicable filters.

---

## 31. Navigation Context

When a user opens a report record and navigates to its source record:

- The originating report context should be preserved where practical.
- Back should return to the previous filtered report state.
- Pagination/filter state should not unnecessarily reset.

This follows the application's global navigation-context rules.

---

## 32. Report Accuracy

Report calculations must use consistent definitions.

Examples:

### Active Payment

A payment whose status is not Reversed.

### Incoming Total

Sum of active incoming payments within the selected scope.

### Outgoing Total

Sum of active outgoing payments within the selected scope.

### Business P&L

Active Incoming − Active Outgoing.

### Bill Paid

A bill whose full bill amount is accounted for through active payment allocations.

---

## 33. Reversed Payment Handling

Reversed payments must remain visible in appropriate payment/audit history.

However, they must be excluded from active financial totals.

Reports may separately show reversed-payment information for reconciliation, such as:

- Reversed amount
- Reversal count
- Reversal date
- Reversal reason

This must not cause reversed payments to be counted again as active business income or expense.

---

## 34. Report Export

Where report export is implemented, exported data must reflect the currently selected:

- Financial Year
- Date range
- Filters
- Search criteria

The export must not silently include records outside the displayed scope.

Exported reports should contain enough identifying information to reconcile them with application records.

---

## 35. Report Read-Only Behavior

Reports are read-only views.

Report screens must not directly:

- Create payments
- Edit payments
- Reverse payments
- Create bills
- Cancel bills
- Modify trips
- Modify masters

Where permitted, users may navigate from a report to the source record and perform an authorized action there.

---

## 36. Dashboard Financial Metrics

The dashboard may show summarized financial metrics such as:

- Receivable
- Payable
- Profit/Loss
- Company outstanding
- Market outstanding
- Vehicle-owner payable
- Credits
- Recent payments

Dashboard figures must use the same underlying definitions as the Financial Reports module.

The dashboard must not implement a separate conflicting financial calculation system.

---

## 37. Recent Payment Reporting

The dashboard/reporting area may display recent payments including:

- Payment ID
- Date
- Type
- Entity
- Category
- Amount
- Mode
- Status

Recent payment figures must follow Payment Module status rules.

---

## 38. Report Performance

Reports may operate across multi-year historical records.

Implementation should therefore use appropriate:

- Database indexes
- Aggregation queries
- Pagination
- Date filtering
- Efficient joins
- Cached/derived values only where correctness is preserved

Performance optimization must not change financial results.

---

## 39. Report Auditability

Financial reports must be explainable from their underlying records.

A user should be able to trace a report total to:

```text
Report
  ↓
Filtered Payment Records
  ↓
Payment Detail
  ↓
Allocation / Related Trip / Bill
  ↓
Audit History
```

This is particularly important for CA review and historical reconciliation.

---

## 40. CA / Tax Reporting Boundary

The application may provide:

- Payment reports
- TDS reports
- Financial-year records
- Supporting financial data
- Bill/payment reconciliation

The application does not replace the CA's formal accounting, tax, or statutory filing responsibilities.

The CA/Tax/ITR area should therefore expose the business records needed by the CA without silently presenting the application as a statutory accounting system.

---

## 41. Reporting and Data Retention

Reports must remain capable of using historical records for multiple years.

The application should not archive or delete structured financial records merely because they are old.

Records required for reporting include, where applicable:

- Payments
- Payment allocations
- Trips
- Bills
- TDS
- Party/Company records
- Vehicle Owner records
- Own-fleet financial records
- Audit history

---

## 42. Report Security

Reports may contain sensitive financial information.

Therefore:

- Authentication is required.
- Role authorization is required.
- CA/Staff/Owner visibility must follow their permissions.
- Export actions must respect the same permissions.
- Report APIs must enforce authorization independently of the frontend.

---

## 43. Non-Negotiable Reporting Rules

1. Financial Reports are payment-derived.
2. Payment Module is the source of truth for actual money movement.
3. Active P&L = Active Incoming Payments − Active Outgoing Payments.
4. Reversed payments are excluded from active financial totals.
5. Payment records are never deleted.
6. Actual received/paid amounts must not be fabricated from trip or bill status.
7. Bills do not become Partially Paid.
8. Bill Paid status is derived from full active payment allocation.
9. Reports do not modify business records.
10. Financial Year filtering must work across historical records.
11. Report totals must be traceable to underlying records.
12. Report drill-down must preserve relevant context where practical.
13. CA access remains read-only according to role permissions.
14. Formal statutory accounting/tax filing remains outside the application's business-reporting calculation.
15. Dashboard financial metrics must use the same definitions as Financial Reports.
