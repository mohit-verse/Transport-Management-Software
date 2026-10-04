# API Specification

## 1. Purpose

This document defines the API contract and architectural rules for the SRL internal web application.

The API connects the frontend with the application's authentication, operational records, financial records, billing, documents, reporting, and configuration.

This document defines API behavior and boundaries. Exact framework syntax, URL prefixing, ORM implementation, and infrastructure choices are implementation details unless explicitly stated here.

---

## 2. API Principles

1. All protected API operations require authentication.
2. Authorization is enforced on the backend.
3. API responses must respect Owner, Staff, and CA permissions.
4. Financial operations must preserve business and audit integrity.
5. Payment Module remains the source of truth for actual money movement.
6. API operations must not create duplicate financial records.
7. Significant mutations must create audit history.
8. Validation must happen server-side.
9. Database transactions must be used for multi-record financial state changes where required.
10. APIs must return predictable, structured responses.
11. Sensitive credentials and secrets must never be returned.
12. APIs must support multi-year historical records.

---

## 3. API Architecture

The application should use a structured HTTP API.

A typical architecture is:

```text
Frontend
   ↓
API Layer
   ↓
Authentication / Authorization
   ↓
Validation
   ↓
Business Services
   ↓
Database / File Storage
```

Business rules must not exist only inside frontend components.

---

## 4. Authentication API

### 4.1 Login

**Purpose:** Authenticate an application user.

Conceptual endpoint:

```http
POST /api/auth/login
```

Request:

```json
{
  "mobile": "string",
  "password": "string"
}
```

Response should provide the authenticated session/token according to the selected authentication architecture and safe user information such as:

```json
{
  "user": {
    "id": "string",
    "name": "string",
    "role": "OWNER|STAFF|CA"
  }
}
```

Passwords must never be returned.

---

## 5. Logout

Conceptual endpoint:

```http
POST /api/auth/logout
```

The server must invalidate the applicable session/token according to the authentication architecture.

---

## 6. Current User

Conceptual endpoint:

```http
GET /api/auth/me
```

Returns the authenticated user's permitted profile information.

Example:

```json
{
  "id": "string",
  "name": "string",
  "role": "OWNER|STAFF|CA"
}
```

---

## 7. Password Recovery

Conceptual API operations:

```http
POST /api/auth/password-recovery/request
POST /api/auth/password-recovery/reset
```

The implementation must use a secure recovery mechanism.

Passwords must never be exposed through these APIs.

---

## 8. Common API Response Structure

The exact response envelope may be selected during implementation, but responses should be consistent.

Success example:

```json
{
  "success": true,
  "data": {}
}
```

Error example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request.",
    "fields": {}
  }
}
```

Internal stack traces, SQL statements, secrets, and infrastructure details must not be returned to the client.

---

## 9. Authentication and Authorization

Every protected endpoint must:

1. Authenticate the request.
2. Identify the user.
3. Verify the user's role.
4. Verify access to the requested resource.
5. Validate the requested operation.
6. Execute the operation only if authorized.

Example:

```text
Staff
  ↓
POST /api/payments/:id/reverse
  ↓
Authorization check
  ↓
Rejected: Owner-only operation
```

Frontend button hiding is not sufficient.

---

## 10. Pagination

Large list endpoints should support pagination.

Typical parameters:

```text
?page=1&pageSize=25
```

The implementation may use cursor pagination where more appropriate.

List responses should provide enough information for the frontend to continue pagination.

Example:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 125
  }
}
```

---

## 11. Search and Filtering

List APIs should support search and combined filters where defined by the module.

Examples:

```text
?q=...
&financialYear=2026-27
&status=...
&fromDate=...
&toDate=...
```

The backend must validate filter values.

Filters must not bypass authorization.

---

# 12. Dashboard API

Conceptual endpoint:

```http
GET /api/dashboard
```

The response should provide role-appropriate dashboard information.

Possible sections:

- Personalized header data
- Business snapshot
- Needs attention
- Financial position
- Trip activity
- Own-fleet performance
- Recent payments

Financial values must follow the same definitions as `REPORTING_SPEC.md`.

Dashboard APIs must not create or modify transactions.

---

# 13. Trips API

## 13.1 List Trips

```http
GET /api/trips
```

Supports relevant:

- Search
- Date filters
- Party/company filters
- Vehicle filters
- Vehicle-owner filters
- Trip status
- POD status
- Billing state
- Pagination
- Combined filters

---

## 13.2 Get Trip

```http
GET /api/trips/:id
```

Returns the complete authorized Trip Detail record, including relevant:

- Party/company
- Vehicle
- Vehicle owner
- Driver
- Route/destinations
- Dates
- Financial details
- POD
- Courier
- Issues
- Billing relationship
- Payment relationship
- Settlement information
- Documents

---

## 13.3 Create Trip

```http
POST /api/trips
```

The API must validate:

- Required trip fields
- Party/company
- Vehicle information
- Vehicle-owner information where applicable
- Dates
- Relationship type
- Financial data
- Own-fleet rules
- Market-vehicle rules

The API must not create an actual payment when creating a trip.

---

## 13.4 Update Trip

```http
PATCH /api/trips/:id
```

Only fields permitted by the user's role and record state may be modified.

Financial changes must create audit history.

Payment records must not be silently created or modified as a side effect of editing trip obligations.

---

## 13.5 Trip Status / Workflow Actions

Where workflow actions require dedicated endpoints, they may be represented conceptually as:

```http
POST /api/trips/:id/complete
POST /api/trips/:id/pod
POST /api/trips/:id/courier
POST /api/trips/:id/settle
POST /api/trips/:id/cancel
```

The exact endpoint decomposition may be selected during implementation.

Every workflow action must enforce the rules in `WORKFLOWS.md`.

---

# 14. Party / Company API

## 14.1 List

```http
GET /api/parties
```

Supports:

- Search
- Party type
- Combined filters
- Pagination

List data should respect the approved Party/Company List fields.

---

## 14.2 Get Party

```http
GET /api/parties/:id
```

Returns authorized master and related information such as:

- Master details
- Billing configuration
- Financial position
- Trips
- Bills
- Payments
- TDS
- Documents

---

## 14.3 Create

```http
POST /api/parties
```

Staff and Owner can create according to role permissions.

---

## 14.4 Update

```http
PATCH /api/parties/:id
```

Master edits must be authorized and audited.

Billing configuration remains a separate Owner-only permission boundary.

---

# 15. Vehicle Owner API

## 15.1 List

```http
GET /api/vehicle-owners
```

Supports search, filters, and pagination.

## 15.2 Get

```http
GET /api/vehicle-owners/:id
```

Returns:

- Owner details
- Owned market vehicles
- Related trips
- Payable position
- Payments
- Documents where applicable

## 15.3 Create

```http
POST /api/vehicle-owners
```

## 15.4 Update

```http
PATCH /api/vehicle-owners/:id
```

Vehicle-owner master changes must be audited.

---

# 16. Market Vehicle API

## 16.1 List

```http
GET /api/market-vehicles
```

## 16.2 Get

```http
GET /api/market-vehicles/:id
```

## 16.3 Create

```http
POST /api/market-vehicles
```

## 16.4 Update

```http
PATCH /api/market-vehicles/:id
```

Market Vehicles do not have an application status field.

The API must not introduce a vehicle-status lifecycle for market vehicles.

---

# 17. Own Fleet API

## 17.1 List

```http
GET /api/own-fleet
```

## 17.2 Get Vehicle

```http
GET /api/own-fleet/:id
```

## 17.3 Create Vehicle

```http
POST /api/own-fleet
```

## 17.4 Update Vehicle

```http
PATCH /api/own-fleet/:id
```

## 17.5 Maintenance Action

Conceptually:

```http
POST /api/own-fleet/:id/maintenance
```

The backend must prevent maintenance assignment while an active trip exists.

## 17.6 Sold/Removed

Conceptually:

```http
POST /api/own-fleet/:id/sold
```

Historical records must remain accessible after the vehicle is marked Sold/Removed.

---

# 18. Payment API

The Payment API is a critical financial API.

## 18.1 List Payments

```http
GET /api/payments
```

Supports:

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
- Pagination

---

## 18.2 Get Payment

```http
GET /api/payments/:id
```

Returns:

- Payment ID
- Date
- Type
- Entity
- Category
- Amount
- Mode
- Status
- Creation information
- Edit information
- Relationships
- Allocation
- Credit impact
- Attachment
- Audit history
- Reversal information

---

## 18.3 Create Payment

```http
POST /api/payments
```

The API must:

1. Validate authenticated user.
2. Validate role.
3. Validate payment data.
4. Validate entity.
5. Validate allocation.
6. Validate business rules.
7. Create the payment.
8. Create allocation/credit effects as applicable.
9. Create audit history.
10. Recalculate affected financial states.

The entire operation should use an appropriate database transaction where multiple records change.

---

## 18.4 Edit Payment

```http
PATCH /api/payments/:id
```

Editing must:

- Keep the same Payment ID.
- Preserve previous values in audit history.
- Validate the new values.
- Recalculate affected financial states.
- Record who and when.
- Preserve payment history.

---

## 18.5 Reallocate Payment

Owner-only:

```http
POST /api/payments/:id/reallocate
```

The API must:

- Verify Owner authorization.
- Validate the new allocation.
- Ensure the entire payment amount remains allocated.
- Recalculate credits/outstanding/settlement.
- Preserve the same Payment ID.
- Create an audit event.

---

## 18.6 Reverse Payment

Owner-only:

```http
POST /api/payments/:id/reverse
```

Request:

```json
{
  "reason": "string"
}
```

The API must:

- Require Owner.
- Require reversal reason.
- Reject already reversed payments.
- Reverse allocations.
- Recalculate credits.
- Recalculate outstanding.
- Recalculate settlement.
- Exclude the payment from active payment-based reports.
- Create audit history.

The payment must remain stored.

---

# 19. Billing API

## 19.1 List Bills

```http
GET /api/bills
```

Supports:

- Search
- Financial Year
- Company/Party
- Status
- Date
- Billing mode
- Pagination

---

## 19.2 Get Bill

```http
GET /api/bills/:id
```

Returns:

- Bill number
- Current version
- Status
- Company/Party
- Trips
- Amount
- Template
- Generated PDF reference where available
- Payment allocations
- Version history
- Audit history

---

## 19.3 Billing Eligibility

Conceptual endpoint:

```http
POST /api/bills/eligibility
```

or an equivalent read-only endpoint.

It must identify whether selected trips satisfy billing requirements.

The API must enforce:

- Completed trip
- POD received
- Unbilled state
- Trip not already included in another active bill

---

## 19.4 Generate Bill

```http
POST /api/bills
```

The API must:

1. Validate authorized user.
2. Validate selected trips.
3. Validate company billing configuration.
4. Validate billing mode.
5. Validate numbering series.
6. Allocate the next valid bill number.
7. Generate the structured bill.
8. Generate/store PDF according to storage rules.
9. Link trips to the bill.
10. Create audit history.

Bill numbering must reset by Financial Year.

---

## 19.5 Bill Version

Conceptually:

```http
POST /api/bills/:id/versions
```

A corrected bill:

- Keeps the same bill number.
- Creates a new version.
- Makes the previous version read-only.
- Makes the new version current.
- Does not consume a new bill number.

---

## 19.6 Submit Bill

```http
POST /api/bills/:id/submit
```

Changes status to:

```text
Submitted
```

The action must be authorized and audited.

---

## 19.7 Bill Cancellation

```http
POST /api/bills/:id/cancel
```

Request:

```json
{
  "reason": "string"
}
```

The API must:

- Require authorized cancellation permission.
- Require a reason.
- Mark the bill Cancelled.
- Return eligible trips to Unbilled.
- Preserve lightweight cancellation metadata.
- Remove full active bill details/files according to the billing rules.
- Prevent restoration.
- Create audit history.

---

# 20. Bill Designer API

## 20.1 List Templates

```http
GET /api/bill-templates
```

## 20.2 Get Template

```http
GET /api/bill-templates/:id
```

## 20.3 Create Template

```http
POST /api/bill-templates
```

## 20.4 Update Template

```http
PATCH /api/bill-templates/:id
```

## 20.5 Import Existing Bill Design

The Bill Designer supports automatic reconstruction from an uploaded PDF/JPG/PNG.

Conceptually:

```http
POST /api/bill-templates/import
```

The system should:

1. Receive the reference file.
2. Reconstruct editable structured elements.
3. Return a reviewable template.
4. Allow the user to correct it.
5. Save the structured template.

The uploaded blank bill must not simply become a permanent static background because consolidated rows may need to cross page/border boundaries.

---

# 21. Numbering Series API

Owner-only configuration.

## 21.1 List

```http
GET /api/numbering-series
```

## 21.2 Create

```http
POST /api/numbering-series
```

## 21.3 Update

```http
PATCH /api/numbering-series/:id
```

## 21.4 Deactivate

```http
POST /api/numbering-series/:id/deactivate
```

The numbering system must:

- Use configurable prefix.
- Generate sequential numbers.
- Reset numbering by Financial Year.
- Never reuse cancelled bill numbers.

---

# 22. Document API

## 22.1 List Documents

```http
GET /api/documents
```

## 22.2 Get Document Metadata

```http
GET /api/documents/:id
```

## 22.3 Upload

```http
POST /api/documents
```

Upload authorization must be checked against the related record.

## 22.4 Replace

Where permitted:

```http
POST /api/documents/:id/replace
```

## 22.5 Delete

Owner-only where deletion is permitted:

```http
DELETE /api/documents/:id
```

Deletion must be audited.

The exact physical storage mechanism is an implementation detail.

---

# 23. Reports API

The Reports API must derive payment-based financial reports from Payment Module records.

## 23.1 Financial Summary

```http
GET /api/reports/financial-summary
```

Possible response:

```json
{
  "incoming": 0,
  "outgoing": 0,
  "pnl": 0
}
```

Values must use active payments only.

---

## 23.2 P&L

```http
GET /api/reports/pnl
```

Supports:

- Financial Year
- Date range
- Category
- Entity
- Payment mode

---

## 23.3 Incoming

```http
GET /api/reports/incoming
```

## 23.4 Outgoing

```http
GET /api/reports/outgoing
```

## 23.5 Payment Mode

```http
GET /api/reports/payment-modes
```

## 23.6 Credits

```http
GET /api/reports/credits
```

## 23.7 TDS

```http
GET /api/reports/tds
```

## 23.8 Bill Reconciliation

```http
GET /api/reports/bill-reconciliation
```

## 23.9 Financial Year Records

```http
GET /api/reports/financial-year
```

Exact report query parameters should follow `REPORTING_SPEC.md`.

---

# 24. Global Search API

Conceptual endpoint:

```http
GET /api/search
```

Searchable identifiers include:

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

```text
Trips
Parties / Companies
Vehicles
Vehicle Owners
Bills
Payments
Documents
```

Each result must respect authorization.

---

# 25. Audit API

## 25.1 Record Audit History

```http
GET /api/audit
```

Supports filters such as:

- Date
- User
- Role
- Module
- Action
- Entity
- Entity ID
- Payment ID
- Bill Number
- Trip Number

## 25.2 Entity Audit History

```http
GET /api/:entity/:id/audit
```

The exact route may be implemented through a generic or module-specific structure.

Audit APIs are read-only through the normal application.

---

# 26. User API

Owner-only management.

## 26.1 List Users

```http
GET /api/users
```

## 26.2 Create User

```http
POST /api/users
```

## 26.3 Update User

```http
PATCH /api/users/:id
```

## 26.4 Activate/Deactivate

```http
POST /api/users/:id/activate
POST /api/users/:id/deactivate
```

Role changes must be audited.

---

# 27. Settings API

Owner-only modification for configuration areas defined by the application.

Possible sections:

- Business Profile
- Financial Year
- Payment Settings
- Trip/Operational Settings
- Document/Storage Settings
- Notification Settings
- Numbering/Identifier Settings
- Security/Account Settings

Example:

```http
GET /api/settings
PATCH /api/settings
```

The implementation may split settings into module-specific endpoints.

All configuration changes must be audited.

---

# 28. Authorization Matrix at API Level

The following high-level rules must be enforced:

| Operation | Owner | Staff | CA |
|---|---|---|---|
| View operational records | Yes | Yes | No |
| Create/edit trips | Yes | Yes | No |
| Manage Party/Company masters | Yes | Yes | No |
| Manage Vehicle Owners | Yes | Yes | No |
| Manage Market Vehicles | Yes | Yes | No |
| Manage Own Fleet | Yes | Yes | No |
| Create payments | Yes | Yes | No |
| Edit payments | Yes | Yes | No |
| Reverse payments | Yes | No | No |
| Completed-payment reallocation | Yes | No | No |
| Generate/edit bills | Yes | Yes | No |
| Modify billing configuration | Yes | No | No |
| View bills | Yes | Yes | Yes |
| View financial reports | Yes | Permitted | Yes |
| Modify documents | Yes | Upload-only where defined | No |
| Manage users | Yes | No | No |
| Modify application settings | Yes | No | No |
| View audit history | Yes | Permitted | Permitted financial scope |

The detailed permission rules remain defined in `ROLES_AND_PERMISSIONS.md`.

---

# 29. Validation Errors

Validation failures should identify the relevant field where practical.

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request contains invalid fields.",
    "fields": {
      "amount": "Amount must be greater than zero."
    }
  }
}
```

The API must not return internal database errors as validation messages.

---

# 30. Authorization Errors

Unauthenticated:

```http
401 Unauthorized
```

Authenticated but not permitted:

```http
403 Forbidden
```

The response should not reveal unnecessary information about protected resources.

---

# 31. Not Found

If a requested record does not exist or should not be exposed to the current user, the API may return:

```http
404 Not Found
```

The implementation should avoid leaking whether protected records exist when such disclosure would create a security issue.

---

# 32. Conflict Handling

The API should use conflict responses for business-state conflicts where appropriate.

Example:

```http
409 Conflict
```

Possible cases:

- Trip already billed
- Payment already reversed
- Duplicate bill-number allocation
- Vehicle currently unavailable for the requested operation
- Concurrent record modification

---

# 33. Database Transaction Boundaries

The following operations should normally be treated as atomic business transactions:

### Payment Creation

```text
Payment
+ Allocation
+ Credit effect
+ Related financial updates
+ Audit
```

### Payment Reversal

```text
Payment status
+ Allocation reversal
+ Credit reversal
+ Financial recalculation
+ Audit
```

### Bill Generation

```text
Bill
+ Bill number
+ Trip-bill relationships
+ Template/version
+ PDF metadata
+ Audit
```

### Bill Cancellation

```text
Bill cancellation
+ Trip unbilling
+ Cancellation metadata
+ Audit
```

If one required operation fails, the system should avoid leaving partial financial state.

---

# 34. Idempotency

Financial and document-generation operations should consider idempotency protection where duplicate requests could create duplicate business records.

Particularly important for:

- Payment creation
- Bill generation
- Payment reversal
- Document uploads
- Other operations where network retries could repeat a mutation

The final implementation should use an appropriate idempotency strategy.

---

# 35. Concurrency

APIs must account for concurrent requests.

Examples:

```text
User A → generates bill
User B → generates bill at the same time
```

The numbering system must still issue unique valid bill numbers.

Similarly:

```text
User A → edits payment
User B → reallocates payment
```

The system must prevent inconsistent financial state.

Database transactions, locking, version checks, or equivalent mechanisms may be used.

---

# 36. API and Audit Integration

Every significant mutation should result in an audit event.

Examples:

```text
POST /api/payments
        ↓
Create Payment
        ↓
Create Audit Event
```

```text
POST /api/payments/:id/reverse
        ↓
Reverse Payment
        ↓
Create Audit Event
```

Audit creation must be part of the business transaction where necessary so that a financial mutation cannot succeed without its required audit record.

---

# 37. API and Reporting Consistency

The same calculation rules must be reused across:

- Dashboard
- Financial Reports
- Party/Company financial position
- Payment details
- Bill reconciliation
- Trip settlement displays

The API should avoid implementing separate conflicting formulas for the same business metric.

---

# 38. API and File Storage

The API should store document metadata in the database while file content is stored through the selected storage mechanism.

Document access should follow:

```text
Authenticated Request
       ↓
Authorization
       ↓
Document Metadata
       ↓
Storage Access
       ↓
Authorized File Response
```

The API must not expose private storage credentials.

---

# 39. API Versioning

The project should reserve a versioning strategy for future compatibility.

A possible structure is:

```text
/api/v1/...
```

The exact versioning approach can be finalized during implementation.

Breaking API changes should not silently alter existing client behavior.

---

# 40. API Documentation

The implementation should maintain machine-readable API documentation where practical, such as OpenAPI/Swagger.

Documentation should describe:

- Endpoint
- Method
- Authentication requirement
- Required role
- Parameters
- Request body
- Response body
- Validation errors
- Authorization errors
- Conflict conditions

The generated API documentation must stay synchronized with the implementation.

---

# 41. Testing Requirements

API tests must cover at minimum:

### Authentication

- Login success
- Login failure
- Logout
- Unauthorized access
- Password recovery

### Authorization

- Owner-only endpoints
- Staff restrictions
- CA restrictions
- Direct unauthorized API calls

### Trips

- Create
- Update
- Lifecycle transitions
- Invalid transitions
- Billing eligibility

### Payments

- Create
- Edit
- Allocation
- FIFO
- Reallocation
- Reversal
- Duplicate request handling
- Concurrent changes

### Bills

- Eligibility
- Generation
- Numbering
- Versioning
- Submission
- Cancellation
- Payment reconciliation

### Documents

- Upload
- Replace
- Delete authorization
- Unauthorized access

### Reports

- Financial Year filtering
- Active/reversed payment handling
- P&L calculation
- Drill-down consistency

### Audit

- Required audit creation
- Before/after values
- Actor attribution
- Immutable audit history

---

# 42. Non-Negotiable API Rules

1. All protected APIs require authentication.
2. Backend authorization is mandatory.
3. Payment Module is the source of truth for actual money movement.
4. Payments are never deleted.
5. Only Owner can reverse payments.
6. Only Owner can reallocate completed payments.
7. Payment IDs remain unchanged after payment edits/reallocations.
8. Payment reversals must remain in history.
9. Bill corrections create versions, not new bill numbers.
10. Cancelled bill numbers cannot be reused.
11. Bill cancellation cannot be restored.
12. Billing configuration changes are Owner-only.
13. Financial Reports are derived from active Payment Module records.
14. Reversed payments are excluded from active financial totals.
15. Significant mutations create audit history.
16. Financial multi-record changes must preserve transactional integrity.
17. API validation must happen server-side.
18. API identifiers are not authorization credentials.
19. Private documents require authorization.
20. Secrets must never be returned to the frontend.
21. Passwords must never be returned or logged.
22. API behavior must respect the role model.
23. Historical multi-year records must remain accessible.
24. API calculations must remain consistent with the documented business rules.
25. The frontend must never be treated as the security boundary.
## 17.7 Expenses

`http
POST /api/own-fleet/expenses
`

Request:
`json
{
  "trip_id": "uuid",
  "expense_category": "DIESEL|FASTAG|BORDER|LOADING|UNLOADING|OTHER",
  "expense_date": "YYYY-MM-DD",
  "amount": 1000.00,
  "charge_name": "string",
  "remark": "string",
  "trip_destination_id": "uuid (optional)"
}
`
The API must:
- Validate that the trip is an OWN_FLEET trip.
- Insert the expense into own_fleet_expense_details.
- Ensure an audit event is created.

## 18.10 Party Credit Utilization

`http
POST /api/payments/credits/utilize
`

Request:
`json
{
  "party_credit_source_id": "uuid",
  "target_trip_id": "uuid (optional)",
  "target_bill_id": "uuid (optional)",
  "payment_id": "uuid (optional)",
  "allocation_amount": 500.00
}
`
The API must:
- Verify Owner or Staff authorization.
- Validate that the source allocation is an active CREDIT_GENERATED allocation for the target party.
- Validate that the target (bill or trip) belongs to the same party.
- Create a CREDIT_UTILIZED allocation in payment_allocations.
- Enforce the utilization bounds against the generated amount.

## 18.11 FIFO Allocation

`http
POST /api/payments/fifo
`

Request:
`json
{
  "party_id": "uuid",
  "amount": 10000.00,
  "payment_id": "uuid (optional)"
}
`
The API must:
- Verify Owner authorization (Staff cannot perform FIFO).
- Execute the FIFO algorithm against unpaid bills/trips in chronological order.
- Create pointer records in payment_fifo_runs and payment_fifo_run_allocations.
- Atomically create the actual canonical allocations in payment_allocations.


## 13.7 Trip Financial Components

`http
PATCH /api/trips/:id/financials
`

Request:
`json
{
  "freight_amount": 5000.00,
  "detention_amount": 200.00,
  "tds_amount": 0,
  "other_charges": [...],
  "deductions": [...],
  "unloading_charges": [...]
}
`
The API must:
- Update the relevant rows in 	rip_party_financials and 	rip_vehicle_owner_financials.
- Insert/Update/Delete rows in 	rip_other_charges, 	rip_deductions, and 	rip_unloading_charges.
- Perform all changes in a single transaction.
- Allow the PostgreSQL AFTER triggers to recalculate the derived eceivable_amount and payable_amount.
- Reject direct updates to derived amounts.


# 43. Comprehensive Error Contract

The backend must return a consistent JSON error format for all failures, never exposing raw PostgreSQL errors or stack traces to clients.

### Standard Format
`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description.",
    "fields": {} 
  }
}
`

### Required Error Categories

1. **Validation Errors** (VALIDATION_ERROR, 400): Client-side or API payload validation failures. Maps ields to specific input errors.
2. **Authentication Errors** (UNAUTHENTICATED, 401): Missing, invalid, or expired session tokens.
3. **Authorization Errors** (FORBIDDEN, 403): User lacks RBAC permissions or entity-level access.
4. **Not Found** (NOT_FOUND, 404): Resource does not exist or user lacks visibility.
5. **Business Rule Violation** (BUSINESS_RULE_VIOLATION, 422): Operation violates a documented business rule (e.g. assigning maintenance to a vehicle in a trip).
6. **Conflict** (CONFLICT, 409): Resource state prevents the action (e.g. Trip already billed, concurrent modification).
7. **Database Constraint Violation** (CONSTRAINT_VIOLATION, 422): Caught and sanitized PostgreSQL CHECK, UNIQUE, or FK constraint failures mapped to user-friendly messages.
8. **Immutable Record Violation** (IMMUTABLE_RECORD, 409): Attempting to mutate or delete a historical/locked record (e.g. reversed payment, old bill version, audit event).
9. **Payment Integrity Violation** (PAYMENT_INTEGRITY_VIOLATION, 422): Any operation that would unbalance payment allocation rules, over-utilize credits, or violate the Payment Module source of truth.
10. **Billing Violation** (BILLING_VIOLATION, 422): Violations of billing rules, such as billing an uncompleted trip, reusing a cancelled bill number, or mismatched party references.
11. **File/Document Errors** (FILE_OPERATION_FAILED, 400/422): Upload validation failures, MIME type rejections, or missing storage bounds.
12. **Unexpected Server Error** (INTERNAL_SERVER_ERROR, 500): Unhandled exceptions, infrastructure failures, or unmapped database errors. Logs must capture the raw error privately.
