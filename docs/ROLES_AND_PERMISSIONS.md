# Roles and Permissions

## 1. Purpose

This document defines the user roles, access boundaries, permissions, and authorization rules for the Shri Sanwariya Road Lines (SRL) software.

The system has three primary roles:

1. Owner
2. Staff
3. CA

The permission system must be enforced on the backend, not only through frontend UI restrictions.

---

# 2. Role Overview

| Area | Owner | Staff | CA |
|---|---|---|---|
| Dashboard | Full | Operational/financial view based on access | Financial view |
| Trips | Full | Full operational access | No |
| Parties / Companies | Full | Create/Edit/View | View only where required for financial context |
| Vehicle Owners | Full | Create/Edit/View | No |
| Market Vehicles | Full | Create/Edit/View | No |
| Own Fleet | Full | Operational access | No |
| Payments | Full | Create/Edit/View | View only |
| Payment Reversal | Yes | No | No |
| Payment Reallocation | Yes | No | No |
| FIFO Bulk Payment Creation | Yes | No | No |
| Bills | Full | Generate/Edit/Regenerate/View | View only |
| Billing Configuration | Full | View/Use only | View only |
| Bill Designer | Full | Use existing templates | No modification |
| Financial Reports | Full | View according to access | Financial/Tax view |
| TDS | Full | Operational entry where applicable | View/CA workflow |
| CA/Tax/ITR | Full access to system data | No | Read-only financial/tax workspace |
| Documents | Full | Upload/View | No document management |
| Users & Roles | Full | No | No |
| Settings | Full | No | No |
| Audit History | Full | Relevant history | Relevant financial history |

---

# 3. Owner Role

## 3.1 General Access

The Owner has unrestricted access to the application.

The Owner can:

- View all records.
- Create records.
- Edit records.
- Perform financial operations.
- Manage billing.
- Manage documents.
- Manage users and roles.
- Configure system settings.
- Reverse payments.
- Reallocate payments.
- Manage FIFO allocations.
- Manage billing configuration.
- Manage bill templates.
- Manage numbering series.
- Manage own-fleet configuration.
- Access financial reports.
- Access CA/tax/ITR-related information.

The Owner is the highest-authority application role.

---

# 4. Staff Role

## 4.1 Operations

Staff has full operational access required for day-to-day transport business.

Staff can:

- Create trips.
- Edit trips.
- View trips.
- Update trip operational information.
- Manage loading/unloading information.
- Manage destinations.
- Manage POD information.
- Upload POD files.
- Manage courier information.
- Create and update issues.
- Resolve/close operational issues.
- Manage own-fleet operations.
- View own-fleet vehicles.
- Create/edit Party and Company records.
- Create/edit Vehicle Owner records.
- Create/edit Market Vehicle records.

Staff cannot delete master records.

---

# 5. Staff Financial Permissions

Staff can work with financial information required for operations.

Staff can:

- View trip financial information.
- Create/edit trip financial details.
- View payment records.
- Create payments.
- Edit payments.
- View payment allocations.
- View outstanding amounts.
- View receivables/payables.
- Use existing financial information for operational work.

Staff cannot:

- Reverse payments.
- Delete payments.
- Reallocate completed payments.
- Create FIFO bulk/unallocated payment allocations.
- Change historical payment allocation decisions.
- Modify financial-system configuration.

All actual payment records remain controlled by the Payment Module.

---

# 6. Staff Billing Permissions

Staff has operational billing access.

Staff can:

- View billing configuration.
- Select completed and eligible trips.
- Generate bills using the existing company configuration.
- Edit bills where permitted.
- Regenerate bills.
- Create a new bill version when required.
- View previous bill versions.
- Download generated bills.
- Submit/send bills using the available workflow.
- View bill-related payments.

Staff cannot:

- Change company billing mode.
- Change the billing template assigned to a company.
- Create/edit/deactivate numbering series.
- Modify required billing fields.
- Modify TDS billing treatment.
- Change company billing configuration.

Billing configuration is Owner-only.

---

# 7. Staff Bill Designer Permissions

Staff can use existing billing templates for bill generation.

Staff cannot modify the underlying billing configuration.

Where the application exposes the Bill Designer to Staff for operational use, Staff must not be able to:

- Change the company's configured billing mode.
- Replace the company's active billing template.
- Modify numbering configuration.
- Change required billing fields.
- Change TDS treatment.

Template-management authority remains with the Owner.

---

# 8. Staff Document Permissions

Staff can:

- View documents available to them.
- Upload new documents.
- Upload POD files.
- Upload courier envelope files.
- Upload issue-related documents.
- Upload relevant trip attachments.

Staff cannot:

- Replace existing documents.
- Delete documents.
- Permanently remove stored files.

Owner has full document-management authority.

---

# 9. Staff User-Management Permissions

Staff cannot:

- Create users.
- Delete users.
- Change user roles.
- Activate/deactivate users.
- Change system-level permissions.
- Manage application administrators.

---

# 10. Staff Settings Permissions

Staff cannot modify system settings.

This includes:

- Business profile settings.
- Financial year configuration.
- Payment settings.
- Trip/operational settings.
- Document/storage settings.
- Notification settings.
- Numbering/identifier settings.
- Security/account settings.

---

# 11. CA Role

The CA is a financial and tax-oriented user.

The CA is not an operational user.

The CA's access is intended for:

- Financial review.
- Payment review.
- TDS review.
- Financial-year records.
- Financial reports.
- Tax/ITR-related information.
- Supporting business records required for accounting/tax work.

---

# 12. CA Payment Permissions

CA has view-only access to payments.

CA can:

- View Payment IDs.
- View payment dates.
- View incoming/outgoing payments.
- View payment categories.
- View entities.
- View payment amounts.
- View payment modes.
- View payment status.
- View allocations.
- View payment history.
- View reversed-payment history.

CA cannot:

- Create payments.
- Edit payments.
- Reverse payments.
- Reallocate payments.
- Create FIFO allocations.
- Delete payment records.

---

# 13. CA Billing Permissions

CA has view-only access to bills.

CA can:

- View bills.
- View bill numbers.
- View bill versions.
- View bill dates.
- View bill amounts.
- View bill status.
- View associated trips.
- View associated payments.
- Download/view generated bill documents where permitted.

CA cannot:

- Generate bills.
- Edit bills.
- Regenerate bills.
- Cancel bills.
- Change billing configuration.
- Modify templates.
- Modify numbering series.

---

# 14. CA TDS Access

CA can access TDS-related information required for financial and tax workflows.

CA can view:

- Party/Company.
- Trip Number.
- TDS amount.
- Related payments.
- Financial Year.
- Relevant dates.
- TDS status/position.
- Supporting records.

The actual TDS amount is entered through the appropriate trip/financial workflow and is not treated as a payment record.

CA cannot modify operational records unless a future explicitly approved CA workflow is introduced.

---

# 15. CA Financial Reports

CA can access financial reports derived from the Payment Module.

Reports may include:

- Total Incoming.
- Total Outgoing.
- Net P&L.
- Payment count.
- Reversed payment history.
- Incoming category totals.
- Outgoing category totals.
- Financial-year summaries.
- Monthly payment breakdown.
- TDS reports.
- Supporting trip/bill references.

Financial report totals must be generated from Payment Module records.

Only active payments contribute to financial totals.

Reversed payments remain visible historically but are excluded from financial totals.

---

# 16. CA/Tax/ITR Workspace

The CA can access the financial/tax workspace on a read-only basis.

The workspace may expose:

- Payment-based income/receipts.
- Business expenses.
- Payment-based P&L.
- Financial-year summaries.
- TDS information.
- Reversed payment history.
- Supporting trip references.
- Supporting bill references.
- Required exports.

The system does not replace the CA's formal statutory accounting or tax responsibility.

CA cannot modify the underlying operational or payment records from this workspace.

---

# 17. CA Operational Restrictions

CA does not have operational access to:

- Trip creation.
- Trip editing.
- Trip cancellation.
- Vehicle operations.
- Own-fleet operations.
- Vehicle Owner management.
- Market Vehicle management.
- POD management.
- Courier management.
- Issue management.
- Operational document management.

CA also cannot manage application users or system configuration.

---

# 18. Party / Company Permissions

## Owner

Owner can:

- Create Party/Company records.
- Edit Party/Company records.
- View complete records.
- Manage billing configuration.
- Manage billing templates.
- Manage numbering series.
- Configure required billing fields.
- Configure TDS treatment.

## Staff

Staff can:

- Create Party/Company records.
- Edit all approved Party Master fields.
- View complete records.
- Create incomplete records through quick-create workflows.
- Use existing billing configuration.

Staff cannot modify billing configuration.

## CA

CA can access Party/Company information when required for financial/tax context.

CA cannot edit Party Master information.

---

# 19. Vehicle Owner Permissions

## Owner

Owner has full access to Vehicle Owner records.

## Staff

Staff can:

- Create Vehicle Owner records.
- Edit Vehicle Owner records.
- View Vehicle Owner records.
- Link market vehicles to Vehicle Owners.
- Complete incomplete records created through trip workflows.

Staff cannot delete Vehicle Owner master records.

## CA

CA does not have operational Vehicle Owner management access.

CA may see Vehicle Owner information where required to understand financial/payment records.

---

# 20. Market Vehicle Permissions

## Owner

Owner has full access to Market Vehicle records.

## Staff

Staff can:

- Create Market Vehicle records.
- Edit Market Vehicle records.
- View Market Vehicle records.
- Link vehicles to Vehicle Owners.
- Create incomplete vehicle records through trip workflows.

Staff cannot delete Market Vehicle master records.

## CA

CA has no operational Market Vehicle management access.

Relevant vehicle information may be visible through financial records where necessary.

---

# 21. Own Fleet Permissions

## Owner

Owner has full access to Own Fleet Management.

Owner can:

- Create own-fleet vehicles.
- Edit vehicle records.
- Manage vehicle status.
- Set maintenance state.
- Mark vehicles Sold/Removed.
- Manage fleet documents.
- Delete expired fleet documents where allowed.
- View historical fleet information.

## Staff

Staff can perform day-to-day own-fleet operations.

Staff can:

- View own-fleet vehicles.
- Use available vehicles for trips.
- Update operational information.
- Perform permitted operational actions.

Staff cannot perform Owner-only administrative actions such as permanent fleet removal or document deletion.

## CA

CA has no operational Own Fleet management access.

---

# 22. Trip Permissions

## Owner

Full access.

## Staff

Staff can:

- Create trips.
- Edit trips.
- View trips.
- Update trip status-related operational information.
- Manage destinations.
- Manage POD.
- Manage courier details.
- Manage issues.
- Enter/edit permitted financial details.
- View payment history.
- View billing information.
- View settlement information.
- View trip P&L.

## CA

CA cannot create or edit trips.

CA may view trip information when required for:

- Financial reports.
- TDS.
- Payment context.
- Bill context.
- Tax/ITR review.

---

# 23. Payment Authority Matrix

| Action | Owner | Staff | CA |
|---|---:|---:|---:|
| View payment | Yes | Yes | Yes |
| Create payment | Yes | Yes | No |
| Edit payment | Yes | Yes | No |
| Delete payment | No | No | No |
| Reverse payment | Yes | No | No |
| Reallocate payment | Yes | No | No |
| Create FIFO bulk payment | Yes | No | No |
| View allocation | Yes | Yes | Yes |
| View audit history | Yes | Yes | Yes |
| Export payment data | Yes | According to access | Yes |

**Important:** Payment records are never permanently deleted.

Reversal is the mechanism for correcting a completed payment.

---

# 24. Billing Authority Matrix

| Action | Owner | Staff | CA |
|---|---:|---:|---:|
| View bills | Yes | Yes | Yes |
| Generate bills | Yes | Yes | No |
| Edit bills | Yes | Yes | No |
| Regenerate bill | Yes | Yes | No |
| Create bill version | Yes | Yes | No |
| Cancel bill | Yes | Yes, if permitted by workflow | No |
| Modify billing configuration | Yes | No | No |
| Manage numbering series | Yes | No | No |
| Manage billing template | Yes | No | No |
| View previous versions | Yes | Yes | Yes |
| Download bill | Yes | Yes | Yes |

Bill cancellation and versioning must follow the billing architecture rules.

---

# 25. Document Authority Matrix

| Action | Owner | Staff | CA |
|---|---:|---:|---:|
| View documents | Yes | Yes | No operational document management |
| Upload documents | Yes | Yes | No |
| Replace documents | Yes | No | No |
| Delete documents | Yes | No | No |
| Manage fleet document expiry | Yes | Operational view only | No |
| Delete generated bill PDF | Yes | No | No |

---

# 26. User and Role Management

Only the Owner can manage application users.

Owner can:

- Create users.
- Assign roles.
- Change roles.
- Activate/deactivate accounts.
- Manage access.
- Manage user-related security settings.
- Review user activity/audit history.

Staff and CA cannot manage users.

---

# 27. Backend Authorization

Frontend visibility must never be treated as authorization.

Every protected action must be authorized by the backend.

For example:

- Hiding the Reverse Payment button from Staff is not sufficient.
- The API must reject a Staff request to reverse a payment.
- Hiding Billing Configuration from Staff is not sufficient.
- The backend must reject Staff attempts to modify billing configuration.
- Hiding User Management from Staff and CA is not sufficient.
- The backend must reject unauthorized user-management requests.

---

# 28. Permission Enforcement Principles

The authorization system must follow these rules:

1. Deny access by default.
2. Grant only explicitly permitted actions.
3. Enforce permissions on the backend.
4. Frontend permissions are for UI visibility and usability only.
5. Every sensitive financial action must be authorization-checked.
6. Every payment reversal must require Owner authorization.
7. Every payment reallocation must require Owner authorization.
8. Billing configuration changes must require Owner authorization.
9. User and role management must require Owner authorization.
10. Document deletion must require Owner authorization.
11. CA access must remain read-only unless a future CA-specific write workflow is explicitly approved.
12. Staff must not gain Owner privileges through frontend manipulation.
13. Role checks must be performed on every protected API endpoint.
14. Permission failures must not expose sensitive implementation details.

---

# 29. Audit Requirements by Role

Actions performed by users must be attributable to the authenticated user.

Important actions should record:

- User ID.
- User role.
- Action.
- Date/time.
- Target record.
- Previous value where applicable.
- New value where applicable.

Financially significant actions require stronger audit coverage, especially:

- Payment creation.
- Payment editing.
- Payment allocation.
- FIFO allocation.
- Payment reallocation.
- Payment reversal.
- Bill generation.
- Bill version creation.
- Bill cancellation.
- Billing configuration changes.
- TDS-related changes.

---

# 30. Role-Based Dashboard Access

Dashboard content must be role-aware.

## Owner Dashboard

Owner can access the complete business dashboard, including:

- Operational snapshot.
- Financial snapshot.
- Outstanding positions.
- Fleet performance.
- Payment activity.
- Billing activity.
- Issues.
- POD status.
- Document expiry alerts.

## Staff Dashboard

Staff sees information required for daily operations and permitted financial/billing work.

## CA Dashboard

CA sees financial and tax-oriented information relevant to the CA role.

CA should not receive operational controls intended for Owner or Staff.

---

# 31. Navigation Access

## Owner

Owner can access all sidebar modules:

- Dashboard
- Trips
- Parties / Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet
- Payments
- Bills
- Financials / Reports
- Documents
- Bill Designer
- Users & Roles
- Settings

## Staff

Staff can access the operational and permitted financial modules:

- Dashboard
- Trips
- Parties / Companies
- Vehicle Owners
- Market Vehicles
- Own Fleet
- Payments
- Bills
- Financials / Reports
- Documents

Staff must not receive access to:

- Users & Roles
- System Settings
- Owner-only billing configuration
- Owner-only payment controls

## CA

CA can access financial/tax-related modules and required supporting records.

CA should not receive operational navigation controls.

---

# 32. Record-Level Authorization

Role authorization must also consider the type of record being accessed.

For example:

- A Staff user may view a payment but cannot reverse it.
- A Staff user may generate a bill but cannot change its company's billing configuration.
- A CA may view a payment but cannot edit it.
- A CA may view a bill but cannot regenerate it.
- An Owner can access all supported records.

Authorization must therefore be based on:

`Role + Resource + Action`

rather than role alone.

---

# 33. Future Permission Expansion

The initial system uses the three approved roles:

- Owner
- Staff
- CA

Do not introduce additional roles or granular permission groups unless explicitly approved.

If the application later requires additional access levels, the permission architecture should allow expansion without weakening existing authorization rules.

---

# 34. Non-Negotiable Security Rules

The following rules are mandatory:

- Payments cannot be permanently deleted.
- Only Owner can reverse payments.
- Only Owner can reallocate completed payments.
- Only Owner can create FIFO bulk/unallocated payment allocations.
- Only Owner can modify billing configuration.
- Only Owner can manage users and roles.
- Only Owner can delete documents.
- Staff cannot obtain Owner permissions through UI manipulation.
- CA cannot modify operational or financial records.
- Backend authorization is mandatory for every protected operation.
- Audit history must remain attributable to the user who performed the action.