# Security Specification

## 1. Purpose

This document defines the security requirements for the SRL internal web application.

The application contains operational records, financial transactions, bills, documents, user accounts, and long-term historical business data. Security controls must protect these records while still allowing Owner, Staff, and CA users to perform their permitted work.

---

## 2. Security Principles

1. Authentication is required for application access.
2. Authorization must be enforced on the backend, not only in the frontend.
3. Users must only access functionality permitted by their role.
4. Financial actions require stronger protection because they affect business records.
5. Payments are never physically deleted; reversal is the controlled mechanism.
6. Audit history must not be editable through normal application permissions.
7. Passwords must never be stored in plaintext.
8. Sensitive authentication information must never appear in logs or audit records.
9. HTTPS must be used for application traffic.
10. Security controls must apply consistently to desktop and mobile interfaces.

---

## 3. Authentication

### 3.1 Login Method

The application uses:

**Mobile Number + Password**

No mandatory SMS/OTP login flow is required.

### 3.2 Login Requirements

The login process must:

- Accept registered mobile number.
- Accept password.
- Validate credentials securely.
- Create an authenticated session/token after successful authentication.
- Reject invalid credentials.
- Apply failed-login throttling/rate limiting.

### 3.3 Password Storage

Passwords must never be stored in plaintext.

Use a modern password hashing algorithm such as:

- Argon2id, or
- bcrypt with an appropriate work factor.

The exact implementation choice is technical and must follow current security best practices.

---

## 4. Session Security

Authenticated sessions must be protected against unauthorized use.

The implementation should use:

- Secure session/token handling
- HTTPS-only transmission
- Secure cookies where cookie-based sessions are used
- Appropriate expiration
- Session invalidation on logout
- Protection against session fixation
- Protection against unauthorized token reuse

The application must not expose authentication tokens unnecessarily to client-side code.

---

## 5. Role-Based Authorization

The system has three application roles:

- Owner
- Staff
- CA

Backend authorization must verify the user's role for every protected operation.

Frontend hiding of buttons or pages is not sufficient security.

Example:

If Staff cannot reverse a payment, the backend must reject a direct API request attempting to reverse one even if the user bypasses the frontend.

---

## 6. Owner Security

Owner has unrestricted business access within the application.

Owner can:

- Manage users and roles
- Manage billing configuration
- Manage numbering series
- Manage templates
- Create/edit operational records
- Create/edit payments
- Reverse payments
- Reallocate payments
- Manage documents
- Access financial reports
- Manage settings

Because Owner has the highest privilege level, Owner authentication must receive the strongest available account protections.

---

## 7. Staff Security

Staff can perform operational and permitted financial work but must not bypass Owner-only controls.

Staff can:

- Create/edit trips
- Manage operational masters
- Upload documents
- Create/edit payments
- Generate/edit/regenerate bills
- View permitted financial information

Staff cannot:

- Reverse payments
- Reallocate completed payments
- Delete payments
- Modify Owner-only billing configuration
- Manage users
- Access restricted administration functionality
- Replace/delete documents where the document rules prohibit it

These restrictions must be enforced server-side.

---

## 8. CA Security

CA is a financial/tax-oriented user.

CA can access permitted:

- Payment records
- Financial reports
- TDS records
- Bills
- Financial-year records
- CA/tax/ITR workspace when implemented

CA cannot:

- Perform operational actions
- Edit masters
- Create/edit/reverse payments
- Generate/edit bills
- Manage documents
- Manage users
- Modify application configuration

CA access must remain read-only unless a future requirement explicitly defines a specific write operation.

---

## 9. Authorization Matrix

The detailed business permission matrix is defined in `ROLES_AND_PERMISSIONS.md`.

This security specification establishes the technical rule:

> Every protected backend endpoint must verify both authentication and authorization before executing the requested action.

Authorization must be checked at:

- Route/API level
- Service/business-logic level where necessary
- Record/entity level where access depends on the specific record

---

## 10. Financial Action Protection

Financial operations must be treated as high-impact actions.

Examples:

- Creating a payment
- Editing a payment
- Allocating a payment
- Reallocating a payment
- Reversing a payment
- Changing trip financial obligations
- Generating a bill
- Cancelling a bill
- Changing billing configuration
- Changing numbering configuration

Each operation must verify:

1. Authenticated user
2. User role
3. Record existence
4. Record state
5. Whether the requested transition is permitted
6. Business rules
7. Audit requirements

---

## 11. Payment Security Rules

### 11.1 No Payment Deletion

Payment records must never be permanently deleted through the application.

### 11.2 Reversal

Only Owner can reverse a payment.

Reversal requires:

- Valid Payment ID
- Active/non-reversed payment
- Reversal reason
- Authenticated Owner
- Audit event

After reversal:

- Payment status becomes Reversed
- Allocations are reversed
- Credits are recalculated
- Outstanding values are recalculated
- Settlement states are recalculated
- Payment-derived financial reports are recalculated

A reversed payment cannot be restored.

---

## 12. Payment Allocation Authorization

Only Owner can:

- Reallocate a completed payment
- Create/reallocate bulk FIFO payment allocation

Staff may create and edit permitted payment records but cannot perform Owner-only allocation operations.

Every allocation modification must produce an audit event.

---

## 13. Input Validation

All client-provided input must be validated server-side.

Validation must cover:

- Required fields
- Data types
- Numeric ranges
- Dates
- Mobile numbers
- GSTIN where applicable
- Identifiers
- File metadata
- Enum/status values
- Record relationships

The backend must never trust frontend validation alone.

---

## 14. Business Rule Validation

Security also requires protection against invalid state transitions.

Examples:

### Trip

The backend must prevent operations that violate the trip lifecycle.

### Billing

A bill must not be generated when its trips are not eligible for billing.

### Payment

A payment must not allocate more than its available amount.

### Bill Numbering

Cancelled bill numbers must never be reused.

### Own Fleet

An own-fleet vehicle under maintenance cannot be assigned a new trip.

These checks must exist in backend business logic.

---

## 15. API Security

All protected APIs must require authentication.

API endpoints must:

- Validate authentication
- Validate authorization
- Validate input
- Validate record ownership/access scope where applicable
- Return controlled error responses
- Avoid leaking internal implementation details

The API must not expose:

- Password hashes
- Authentication secrets
- Internal security tokens
- Unnecessary database details
- Sensitive audit implementation data

---

## 16. Rate Limiting

Rate limiting should be applied to security-sensitive endpoints, especially:

- Login
- Password reset/recovery
- Authentication/session endpoints
- High-frequency API operations where abuse is possible

Failed login attempts should be throttled to reduce credential-guessing attacks.

---

## 17. Password Recovery

The application must provide a secure password recovery mechanism.

Recovery must:

- Verify the user through an approved recovery process.
- Avoid revealing whether sensitive account information exists unnecessarily.
- Use short-lived recovery credentials/tokens where applicable.
- Invalidate recovery credentials after use or expiration.
- Never expose the existing password.

The exact recovery channel is an implementation decision and must not weaken the mobile-number/password authentication model.

---

## 18. HTTPS

All production application traffic must use HTTPS.

The system must not transmit:

- Passwords
- Session credentials
- Financial information
- Document access credentials

over unencrypted HTTP connections.

HTTP-to-HTTPS redirection may be used where appropriate.

---

## 19. Database Security

Database access must be restricted to the application/service layer.

The application should:

- Use parameterized queries or a safe ORM/query builder.
- Prevent SQL injection.
- Keep database credentials outside source code.
- Use environment/configuration secrets.
- Restrict database network exposure.
- Apply least-privilege database credentials where practical.

Production database credentials must never be committed to Git.

---

## 20. Secrets Management

Secrets must not be stored in:

- Source code
- Public repositories
- Frontend bundles
- Client-visible configuration
- Audit history
- Application screenshots

Examples of secrets include:

- Database passwords
- API keys
- Session secrets
- Encryption keys
- Storage credentials
- Third-party service credentials

Use environment variables or an appropriate secret-management mechanism.

---

## 21. File Upload Security

The application accepts documents and images such as:

- POD files
- Courier envelope images/files
- Vehicle documents
- Other permitted business documents
- Bill PDFs

Uploaded files must be validated.

Security controls should include:

- File type validation
- File size limits
- Safe file naming
- Storage outside executable application paths where appropriate
- Malware scanning where practical
- Access authorization before download
- No direct public exposure of private business documents

The system must not trust a file's extension alone when validating uploads.

---

## 22. Document Access

Documents are business records and must not automatically be public.

Before serving a protected document, the backend must verify that the authenticated user is authorized to access the related record.

Examples:

- Trip POD → authorized trip access required
- Vehicle document → authorized fleet access required
- Bill PDF → authorized bill/company access required

Document URLs should not provide unrestricted access merely because a user knows the URL.

---

## 23. Audit Security

Audit records must be protected from ordinary modification.

Users must not be able to:

- Edit audit entries
- Delete audit entries
- Change audit timestamps
- Change the acting user
- Rewrite historical values

Passwords and authentication secrets must never be recorded in audit events.

Detailed audit requirements are defined in `AUDIT_AND_HISTORY.md`.

---

## 24. Error Handling

Errors returned to users should be useful without exposing internal security information.

Do not expose:

- Database stack traces
- SQL statements
- Internal filesystem paths
- Secret values
- Authentication implementation details

Production error responses should use controlled messages.

Detailed technical errors may be recorded in secure server logs where appropriate.

---

## 25. Logging

Application logs and audit logs are separate.

### Application Logs

Used for:

- Errors
- Diagnostics
- Performance problems
- Infrastructure events
- Security events

### Audit Logs

Used for:

- Business-significant user actions
- Financial changes
- Record changes
- Permission/admin actions

Sensitive values must be excluded from both where they are not required.

---

## 26. Security Events

The system should record security-relevant events such as:

- Successful login
- Failed login
- Logout
- Password recovery request
- Password change
- Account activation/deactivation
- Role change
- Repeated authentication failures
- Unauthorized API attempts

Security logs must not store passwords or authentication secrets.

---

## 27. Data Protection

The system contains business-sensitive information including:

- Mobile numbers
- Financial transactions
- Bills
- Payment history
- Business documents
- Vehicle information
- Tax-related records

Access must follow the role model.

The application should minimize unnecessary exposure of sensitive information in:

- Lists
- API responses
- Logs
- URLs
- Browser storage
- Error messages

---

## 28. Financial-Year Data Integrity

Historical records must remain accessible across financial years.

Security controls must not allow a user to silently:

- Move financial records between years
- Reuse cancelled bill numbers
- Rewrite historical payment identity
- Delete payment history
- Alter audit timestamps

Any legitimate correction must use the application's supported correction/version/reversal mechanisms.

---

## 29. Bill Security

Bills must follow these security rules:

- Only authorized users can generate/edit bills.
- Billing configuration changes are Owner-only.
- Bill versions are immutable once superseded.
- Cancelled bills cannot be restored.
- Bill cancellation requires a reason.
- Bill PDFs must be access-controlled.
- Generated PDF deletion is Owner-only.
- Staff can view/download generated bill PDFs but cannot delete them.

---

## 30. Billing Configuration Security

Only Owner can modify:

- Individual/consolidated billing mode
- Billing template
- Numbering series
- Required billing fields
- TDS treatment

Staff may use existing configuration but cannot modify it.

CA has view-only access where applicable.

Every configuration change must be audited.

---

## 31. User Management Security

Only Owner can manage application users.

Owner can:

- Create users
- Assign roles
- Activate/deactivate users
- Manage user access

A deactivated user must not be able to start or continue unauthorized application access according to the session invalidation strategy.

Role changes must be audited.

---

## 32. Frontend Security

The frontend must:

- Avoid storing sensitive secrets.
- Avoid exposing backend credentials.
- Enforce UI-level permission visibility.
- Treat backend authorization as authoritative.
- Sanitize or safely render user-generated content.
- Avoid unsafe HTML rendering unless explicitly sanitized.

Frontend restrictions are usability controls, not the primary authorization mechanism.

---

## 33. CSRF Protection

If cookie-based authentication is used, appropriate CSRF protection must be implemented for state-changing requests.

If token-based authentication is used, the chosen architecture must still protect authentication credentials from cross-site misuse.

The final implementation must document the selected mechanism.

---

## 34. XSS Protection

User-controlled values such as:

- Party names
- Remarks
- Charge names
- Addresses
- Bill content
- Document names

must be safely rendered.

The application must prevent user input from becoming executable browser code.

The Bill Designer requires particular care because it contains structured editable content.

---

## 35. Injection Protection

The backend must protect against:

- SQL injection
- Command injection
- Path traversal
- Unsafe file handling
- HTML/script injection
- Template injection where applicable

All external input must be treated as untrusted.

---

## 36. Backup and Recovery

Business-critical structured records require reliable backups.

Backups should include:

- Trips
- Parties/Companies
- Vehicle Owners
- Vehicles
- Payments
- Bills and bill metadata
- Financial records
- Audit history
- Configuration required to reconstruct records

File backups should follow the selected document-storage architecture.

Recovery procedures must be tested rather than assuming that backups are usable.

---

## 37. Recovery Integrity

After restoration, the application must preserve:

- Payment IDs
- Bill numbers
- Trip identifiers
- Audit history
- Financial-year relationships
- Bill versions
- Reversal states
- Allocation relationships

Restoration must not create duplicate financial transactions.

---

## 38. Transaction Integrity

Financial operations that modify multiple related records should use database transactions where appropriate.

Examples:

### Payment Reversal

A reversal may require simultaneous updates to:

- Payment status
- Payment allocations
- Credit
- Outstanding
- Settlement
- Payment-derived financial reporting state
- Audit history

These related changes should not leave the system in a partially updated state.

### Bill Cancellation

Cancellation may require:

- Bill status update
- Trip billing relationship changes
- Cancellation metadata
- Audit event

The implementation should preserve consistency if an operation fails.

---

## 39. Concurrency Protection

The system must account for two users attempting to modify the same financial record.

Examples:

- Two users editing a payment
- Payment being allocated while another user edits it
- Bill generation while another user changes a trip
- Two users attempting to use the same bill-number series

The backend must use appropriate database constraints/transactions/locking or equivalent mechanisms to prevent inconsistent financial states.

---

## 40. Identifier Security

Business identifiers such as:

- Trip Number
- Bill Number
- Payment ID

must not be treated as authorization credentials.

Knowing an identifier must never be sufficient to access a record.

Authorization must still be checked.

---

## 41. Production Deployment

Production deployment must:

- Disable development/debug modes.
- Protect environment secrets.
- Use HTTPS.
- Restrict database access.
- Use secure server configuration.
- Keep dependencies updated.
- Apply security patches.
- Restrict administrative infrastructure access.

---

## 42. Dependency Security

Third-party packages and services must be reviewed for security risks.

The project should:

- Keep dependencies reasonably current.
- Remove unused packages.
- Monitor known vulnerabilities.
- Avoid unnecessary third-party services.
- Pin or control versions where appropriate.

---

## 43. Security Testing

Before production release, test at minimum:

### Authentication

- Invalid password
- Invalid mobile number
- Repeated failed login
- Logout
- Password recovery

### Authorization

- Staff attempting Owner-only actions
- CA attempting operational actions
- Unauthorized API requests
- Access to another restricted record

### Financial Security

- Payment deletion attempt
- Unauthorized payment reversal
- Unauthorized payment reallocation
- Over-allocation
- Duplicate financial transaction
- Concurrent payment modification

### Billing

- Billing before eligibility
- Duplicate bill generation
- Reuse of cancelled bill number
- Unauthorized billing configuration change
- Unauthorized PDF deletion

### Documents

- Unauthorized document access
- Invalid file type
- Oversized upload
- Path traversal attempt

### Audit

- Attempt to modify audit history
- Attempt to delete audit history
- Missing actor/timestamp
- Missing before/after data for applicable changes

---

## 44. Security Acceptance Criteria

The security implementation is acceptable only when:

1. Authentication is required for protected application access.
2. Passwords are securely hashed.
3. HTTPS is enforced in production.
4. Backend role authorization is implemented.
5. Owner-only actions cannot be executed by Staff or CA.
6. Payments cannot be deleted.
7. Payment reversals are Owner-only and audited.
8. Payment allocation changes are authorized and audited.
9. Bill configuration changes are Owner-only.
10. Audit history cannot be modified through the application.
11. Protected documents require authorization.
12. Uploaded files are validated.
13. Secrets are not committed or exposed.
14. Financial operations maintain transactional integrity.
15. Concurrent financial operations cannot create inconsistent states.
16. Security-sensitive events are logged without exposing secrets.
17. Backup and recovery procedures preserve financial and audit integrity.

---

## 45. Non-Negotiable Security Rules

1. Backend authorization is mandatory.
2. Frontend-only permission checks are insufficient.
3. Passwords must never be stored in plaintext.
4. Passwords must never appear in logs or audit history.
5. HTTPS is required in production.
6. Payments are never deleted.
7. Only Owner can reverse payments.
8. Only Owner can perform completed-payment reallocation.
9. Only Owner can modify billing configuration.
10. Audit history cannot be edited or deleted through the application.
11. Protected documents cannot be publicly accessible by identifier alone.
12. Financial changes must preserve auditability.
13. Financial operations must maintain database consistency.
14. Security secrets must remain outside source code and client bundles.
15. Historical financial records must remain protected and intact.
