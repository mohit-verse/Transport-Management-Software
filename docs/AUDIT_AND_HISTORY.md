# Audit and History Specification

## 1. Purpose

The SRL application must maintain a reliable chronological history of significant business and system actions.

Audit history exists to answer:

- What happened?
- Which record was affected?
- Who performed the action?
- When did it happen?
- What changed?
- What was the previous value?
- What is the new value?
- What was the resulting business state?

Audit history is separate from ordinary record data. It must not replace the underlying business record.

---

## 2. Core Principles

1. Significant financial and operational actions must be auditable.
2. Audit entries are chronological.
3. The acting user and exact date/time must be recorded.
4. Financial changes must preserve before/after values where applicable.
5. Payment reversals are never treated as deletion.
6. Payment edits preserve the previous values and the updated values.
7. Payment allocation changes must be auditable.
8. Bill version changes must preserve the previous bill version.
9. Audit history must remain available even when a business record changes state.
10. Audit history must not silently alter the underlying record.
11. Audit records are system-generated, not manually typed by users.
12. Role permissions apply to audit-history access.

---

## 3. Audit Event Structure

Each audit event should contain, at minimum:

- Audit Event ID
- Date/time
- Acting User
- User Role
- Action Type
- Module
- Entity Type
- Entity ID
- Human-readable entity reference where available
- Description
- Before Value where applicable
- After Value where applicable
- Related Entity References where applicable

The exact technical storage format is an implementation detail, but the information above must remain available.

---

## 4. Timestamp Rules

Every audit event must use the server-generated date/time.

The system must not rely on a timestamp entered manually by the user.

For actions that already have a business date separate from the system action time, both concepts must remain distinct.

Example:

- Payment Date: the date of the actual payment.
- Audit Date/Time: when the user created or changed the payment record.

This distinction must be preserved throughout the system.

---

## 5. User Attribution

Each auditable action must identify the authenticated user who performed it.

The audit record should preserve:

- User ID
- User display/name reference
- Role at the time of action, where available

The audit record must not depend only on the user's current profile information because user details or permissions may change later.

---

## 6. Action Categories

The system should support audit events for actions including:

### Record Creation

Examples:

- Trip created
- Party created
- Company created
- Vehicle owner created
- Market vehicle created
- Own-fleet vehicle created
- Payment created
- Bill generated
- Document uploaded

### Record Editing

Examples:

- Trip edited
- Party details edited
- Vehicle owner details edited
- Market vehicle details edited
- Own-fleet vehicle details edited
- Payment edited
- Financial values edited
- Billing configuration edited

Where meaningful, the audit event must contain before and after values.

### Status Changes

Examples:

- Trip status changed
- POD status changed
- Courier sent
- Own-fleet vehicle moved to maintenance
- Own-fleet vehicle returned to available state
- Own-fleet vehicle marked sold/removed
- Bill status changed
- Payment status changed

### Financial Actions

Examples:

- Payment created
- Payment edited
- Payment allocation created
- Payment allocation changed
- FIFO allocation performed
- Credit generated
- Credit utilized
- Payment reversed
- Financial position recalculated because of a financial action

### Billing Actions

Examples:

- Bill generated
- Bill submitted
- Bill marked paid by system
- Bill version generated
- Bill cancelled
- Bill numbering series changed
- Billing configuration changed
- Bill template changed

### Document Actions

Examples:

- Document uploaded
- Document replaced
- Document deleted
- Generated bill PDF deleted

### Administrative Actions

Examples:

- User created
- User role changed
- User activated/deactivated
- Security/account setting changed
- Business configuration changed

---

## 7. Payment Audit Requirements

Payments require enhanced audit handling because they are the authoritative record of actual money movement.

### 7.1 Payment Creation

When a payment is created, record:

- Payment ID
- Payment date
- Type
- Entity
- Category
- Amount
- Mode
- Initial allocation
- Credit generated, if any
- Created by
- Created date/time

### 7.2 Payment Edit

Editing a payment must:

1. Keep the same Payment ID.
2. Preserve the previous values.
3. Record the new values.
4. Record who edited it.
5. Record when it was edited.
6. Recalculate affected financial positions.
7. Recalculate affected settlement states where applicable.

The audit history must clearly show the changed fields.

### 7.3 Payment Allocation Change

When an allocation changes, record:

- Previous allocation
- New allocation
- Affected trip/bill
- Previous allocation type
- New allocation type
- Previous credit impact
- New credit impact
- Acting user
- Date/time
- Reason, where collected by the UI

The resulting outstanding and settlement values must be recalculated.

### 7.4 FIFO Allocation

FIFO allocation must be auditable.

The audit record should identify:

- Payment ID
- Entity
- Receivables considered
- Allocation order
- Allocated amounts
- Credit generated, if applicable
- Acting user
- Date/time

The system must preserve enough information to explain how the payment was distributed.

### 7.5 Payment Reversal

Payment reversal is an auditable financial action.

A reversal must record:

- Payment ID
- Original payment information
- Reversal status
- Reversal reason
- Reversed by
- Reversal date/time
- Allocation reversal
- Credit reversal where applicable
- Resulting financial changes
- Resulting settlement changes

A reversed payment cannot be restored.

A new payment must be created if the transaction needs to be recorded again.

---

## 8. Trip Financial Audit

Trip financial fields can establish receivable/payable obligations, while actual money movement remains in the Payment Module.

When trip financial details are edited, audit history should identify:

- Previous value
- New value
- Field changed
- User
- Date/time

Examples include:

- Freight
- Detention
- Unloading charges
- Other charges
- Shortage/damage deductions
- TDS amount
- Own-fleet expense-related trip information where applicable

Changing a trip obligation must not create a duplicate payment record.

---

## 9. Bill Audit and Version History

Bills have their own version history in addition to audit events.

### 9.1 Bill Generation

Record:

- Bill number
- Version
- Company/Party
- Selected trips
- Billing mode
- Template used
- Numbering series
- Generated by
- Generated date/time

### 9.2 Bill Revision

When a billed trip's details change and the bill is regenerated:

- The same Bill Number remains.
- A new version is created.
- The previous version becomes read-only.
- The latest version becomes current.
- The audit history records the reason/action and version transition.

Example:

`SRL/26-27/001 v1` → `SRL/26-27/001 v2`

A correction does not consume a new bill number.

### 9.3 Bill Cancellation

Cancellation must record:

- Bill number
- Cancellation reason
- Cancelled by
- Cancellation date/time
- Related trips
- Previous bill status
- New status: Cancelled

The full cancelled bill details/document files may be removed from active storage according to the billing rules, while lightweight cancellation metadata remains permanently available.

A cancelled bill cannot be restored.

---

## 10. Document Audit

Document actions must be traceable.

For each document event, record:

- Document type
- File name/reference
- Related entity
- Action
- Acting user
- Date/time
- Previous document reference where replacement occurred
- New document reference where replacement occurred

### Replacement

When a document is replaced:

- The replacement action is audited.
- Basic historical metadata for the previous document remains where required by the document-retention rules.
- The active document becomes the newly uploaded document.

### Deletion

When an Owner deletes an allowed document:

- The deletion is audited.
- The system records the affected document and related record.
- The deleted file itself does not need to remain in active storage.

---

## 11. Own-Fleet Document History

For own-fleet documents:

- A new document of the same type makes the old document inactive.
- The old file may be deleted according to the storage rule.
- Historical metadata remains:
  - Document type
  - Document number, where applicable
  - Old expiry date
  - Replacement date
  - Replacement reference

The audit history must record the replacement event.

---

## 12. User and Permission Audit

Administrative actions must be auditable.

Examples:

- User creation
- User activation
- User deactivation
- Role change
- Password/security setting changes where the application exposes such administrative actions
- Billing configuration changes
- Numbering-series changes
- Business settings changes

The audit record must identify:

- Administrator/user
- Previous configuration
- New configuration
- Date/time

Sensitive authentication secrets must never be stored in audit logs.

Passwords must never appear in audit history.

---

## 13. Audit Visibility by Role

### Owner

Owner can view audit history for all supported modules and records.

### Staff

Staff can view audit history relevant to records they can access.

Staff cannot modify or delete audit entries.

### CA

CA can view audit history relevant to financial and tax records they are permitted to view.

CA does not receive operational administration privileges through audit access.

---

## 14. Audit Immutability

Audit records must not be editable through the normal application UI.

No user role should be able to:

- Edit an audit event
- Delete an audit event
- Rewrite historical values
- Change the acting user
- Change the audit timestamp

If a technical maintenance mechanism is ever required, it must be outside ordinary application permissions and separately controlled.

---

## 15. Audit Timeline UI

Where practical, each major record should expose a chronological audit timeline.

Example structure:

```text
01 Oct 2026, 11:42 AM
Payment edited
By: Staff User

Amount
₹95,000 → ₹90,000

Mode
Bank Transfer → UPI
```

The timeline should make significant changes understandable without requiring users to inspect raw database records.

---

## 16. Financial Record History

Financial records must be explainable across modules.

For example, when a trip shows a changed outstanding amount, the user should be able to trace relevant events such as:

```text
Trip financial value changed
        ↓
Payment created
        ↓
Payment allocated
        ↓
Credit generated/utilized
        ↓
Payment reversed
        ↓
Outstanding recalculated
```

The exact UI can vary, but the underlying history must preserve the chronological sequence.

---

## 17. Cross-Module Audit References

Audit events should reference related records where applicable.

Examples:

- Payment → Trip
- Payment → Bill
- Payment → Party/Company
- Payment → Vehicle Owner
- Bill → Party/Company
- Bill → Trips
- Trip → Party/Company
- Trip → Vehicle Owner
- Document → Trip
- Document → Vehicle
- Configuration → affected module

This allows users to understand the business context of an event.

---

## 18. Recalculation Events

The system may recalculate:

- Outstanding
- Credit
- Settlement
- Trip P&L
- Payment-derived financial reports

A recalculation caused by a user action should be traceable to the triggering action.

The system should not create meaningless audit noise for every internal calculation.

The audit trail should focus on business-significant state changes.

---

## 19. Financial Reports and Auditability

Financial Reports are derived from Payment Module records.

Therefore, the audit trail must allow users to explain changes in payment-derived reports through the underlying payment events.

For P&L:

```text
Active Incoming Payments
        −
Active Outgoing Payments
        =
Business P&L
```

Reversed payments must not contribute to active payment-based P&L.

If a payment is edited, allocated differently, or reversed, the resulting report change must be traceable through the payment's history.

---

## 20. Search and Filtering

Audit history should support filtering by relevant criteria such as:

- Date range
- User
- Role
- Module
- Action type
- Entity type
- Entity ID/reference
- Financial action
- Payment ID
- Bill number
- Trip number

Global search should not require exposing every audit event as a global search result. Audit history should primarily be accessed from the relevant record or audit/history area.

---

## 21. Retention

Core audit history should be retained for the same long-term business-history principle as the underlying structured records.

The system must not automatically delete significant financial audit history simply because:

- a trip is old,
- a bill is cancelled,
- a payment is reversed,
- a document file is deleted.

File-retention rules and audit-history retention are separate concerns.

---

## 22. Audit vs Business History

These are different layers.

### Business History

Represents the current and historical business records:

- Trips
- Payments
- Bills
- Parties
- Vehicle Owners
- Vehicles
- Documents
- Financial records

### Audit History

Represents actions performed on those records:

- Created
- Edited
- Allocated
- Reallocated
- Reversed
- Submitted
- Cancelled
- Replaced
- Deleted
- Configuration changed

Both layers must remain consistent.

---

## 23. Non-Negotiable Rules

1. Payments are never deleted.
2. Payment reversal must be recorded as an auditable action.
3. Payment edits preserve previous and new values.
4. Payment allocation changes are auditable.
5. FIFO allocation is auditable.
6. Bill revisions create versions rather than new bill numbers.
7. Previous bill versions are read-only.
8. Bill cancellation retains lightweight cancellation metadata.
9. Audit entries cannot be edited or deleted through the application.
10. Passwords and authentication secrets must never appear in audit logs.
11. Server-generated timestamps must be used.
12. Significant financial actions must identify the acting user.
13. Financial reports are derived from Payment Module records.
14. Reversed payments are excluded from active payment-based financial totals.
15. Audit history must remain usable for multi-year historical records.
