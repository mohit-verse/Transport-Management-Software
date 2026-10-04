# Bill Designer Specification

## 1. Purpose

The Bill Designer is the structured document-design system used to create and maintain Company billing templates for the Shri Sanwariya Road Lines (SRL) application.

It must allow the Owner to create reusable billing templates that can generate:

- Individual Bills.
- Consolidated Bills.
- Multi-page Bills.
- Bills containing dynamic business data.
- Bills containing repeatable Trip rows.

The Bill Designer must generate Bills from structured editable elements rather than relying on a fixed background image.

---

# 2. Ownership and Access

## Owner

The Owner has full Bill Designer access.

The Owner can:

- Create templates.
- Edit templates.
- Replace templates.
- Review imported templates.
- Configure dynamic fields.
- Configure layout.
- Configure repeatable sections.
- Configure assets.
- Save templates.
- Assign a template to a Company.
- Change a Company's configured template.

## Staff

Staff can use existing configured templates for operational billing.

Staff cannot modify the Company's billing configuration or replace the configured billing template.

## CA

CA has no template-management authority.

CA may view billing information where required for financial/tax work.

---

# 3. Template Model

A Billing Template is a structured representation of a Bill.

The template must contain editable elements rather than being stored only as an image.

A template may contain:

- Text.
- Tables.
- Borders.
- Lines.
- Dynamic Fields.
- Images.
- Logo.
- Signature.
- Stamp.
- Page Headers.
- Page Footers.
- Spacing.
- Alignment.
- Repeatable Trip Rows.
- Calculated Fields.
- Page Breaks.

---

# 4. Template Lifecycle

The general workflow is:

```text
Create / Import Template
        ↓
Automatic Reconstruction if Imported
        ↓
Review
        ↓
Correct Layout
        ↓
Configure Dynamic Fields
        ↓
Configure Repeatable Sections
        ↓
Add Assets
        ↓
Save Structured Template
        ↓
Assign to Company
        ↓
Generate Bills
```

The Bill Designer must preserve the structured template independently from individual generated Bills.

---

# 5. Existing Bill Import

The Bill Designer must support importing an existing reference Bill.

Supported input formats:

- PDF.
- JPG.
- PNG.

The import process must automatically attempt to reconstruct editable elements.

Workflow:

```text
Upload Reference Bill
        ↓
Automatic Reconstruction
        ↓
Editable Structured Layout
        ↓
User Review
        ↓
User Correction
        ↓
Save Template
```

Manual reconstruction is not a separate starting workflow.

---

# 6. Automatic Reconstruction

Automatic reconstruction should identify the editable structure of the uploaded reference Bill, including where applicable:

- Text.
- Tables.
- Lines.
- Borders.
- Images.
- Logos.
- Signatures.
- Stamps.
- Alignment.
- Spacing.
- Headers.
- Footers.

The Owner must be able to review and correct the reconstructed result before saving it as a structured template.

The reconstructed result must not be treated as final without review.

---

# 7. Structured Template Requirement

An uploaded reference Bill must not simply become a fixed background image for final Bill generation.

The final template must consist of structured editable elements.

This is required because:

- Consolidated Bills can contain a variable number of Trips.
- Trip rows can span multiple pages.
- Dynamic values can have different lengths.
- Tables may need to expand.
- Page content may shift based on data.

The template renderer must therefore work with structured content.

---

# 8. Editor Canvas

The Bill Designer should provide a visual editor for the structured Bill layout.

The editor must allow the Owner to work with the document's layout and elements.

Elements must remain independently editable where the reconstruction process can identify them.

The editor should preserve:

- Position.
- Size.
- Alignment.
- Text properties.
- Table structure.
- Borders.
- Spacing.
- Page structure.

The exact visual editor implementation is an implementation detail and must not change the underlying template requirements.

---

# 9. Text Elements

The template must support editable text elements.

A text element may contain:

- Static text.
- Dynamic fields.
- Mixed static and dynamic content.

Example:

```text
Bill No: {{bill.number}}
```

or:

```text
Customer: {{party.name}}
```

The actual dynamic field syntax is an implementation detail.

---

# 10. Tables

The template must support structured tables.

Tables must support:

- Multiple rows.
- Multiple columns.
- Borders.
- Cell content.
- Alignment.
- Dynamic fields.
- Repeatable rows.
- Variable row counts.
- Multi-page continuation where required.

Tables must not be implemented only as flattened images.

---

# 11. Lines and Borders

The editor must support:

- Horizontal lines.
- Vertical lines.
- Table borders.
- Section borders.
- Configurable positioning.
- Configurable sizing where applicable.

Lines and borders are layout elements and must remain part of the structured template.

---

# 12. Dynamic Field System

The Bill Designer must expose dynamic fields from the approved SRL data model.

The system must not limit the Designer to a tiny fixed collection of tags.

Dynamic fields should be organized by their source.

Possible source groups include:

- Party / Company.
- Trip.
- Vehicle.
- Vehicle Owner where applicable.
- Destination.
- Billing.
- Financial data.
- Other approved master data.

Only fields that exist as structured application data can be exposed as dynamic fields.

---

# 13. Party / Company Fields

The Bill Designer should make approved Party / Company information available as dynamic fields.

Examples include:

- Party / Company Name.
- Primary Mobile Number.
- Full Address.
- City.
- State.
- PIN Code.
- GSTIN.
- Billing Address.
- Party Type.

TDS-related fields may be available where applicable to the configured billing workflow.

---

# 14. Trip Fields

The Bill Designer should make approved Trip information available as dynamic fields.

Examples include:

- Trip Number.
- Trip Type.
- Vehicle Number.
- Driver Mobile Number.
- Vehicle Owner information where applicable.
- Origin.
- Origin City.
- Origin State.
- Loading Date.
- Unloading Date.
- Trip-related financial values.
- Billing-related values.
- LR information.
- Invoice information.

The available fields should follow the structured Trip data model rather than a manually maintained short list.

---

# 15. Destination Fields

Destination data must support repeatable Trip structures.

Possible fields include:

- Destination.
- City.
- State.
- Unloading Date.
- Party-side Unloading Charge.
- Vehicle-owner Unloading Charge where applicable.
- Own-fleet Unloading Expense where applicable.
- Destination Sequence.

Multiple destinations must be representable.

---

# 16. Vehicle Fields

Approved vehicle information should be available to the template.

Examples include:

- Vehicle Number.
- Vehicle Owner information where applicable.
- Driver Mobile Number.

The template must use the appropriate relationship depending on whether the Trip uses:

- Market Vehicle.
- Own Fleet Vehicle.

---

# 17. Billing Fields

The template must support Bill-level dynamic information.

Examples include:

- Bill Number.
- Bill Version.
- Bill Date.
- Billing Mode.
- Company.
- Financial Year.
- Bill Status where appropriate.
- Current billing information.

---

# 18. Financial Fields

Approved financial information may be exposed to the Bill Designer.

Examples may include:

- Freight.
- Unloading Charges.
- Detention.
- Other Charges.
- Deductions.
- TDS.
- Total Receivable.
- Applicable Bill Amount.

Financial fields must use the application's structured financial calculations.

The template must not create an independent financial calculation ledger.

---

# 19. Calculated Fields

The Bill Designer must support calculated fields where the underlying calculation is already defined by the application's business logic.

A template may display a calculated value.

The template must not redefine the application's authoritative financial rules.

For example:

```text
Bill Amount
= Sum of Included Billable Trip Amounts
```

The calculation must come from the application data/business logic.

---

# 20. Repeatable Trip Rows

Consolidated Bills require repeatable Trip rows or sections.

The template must support:

```text
Trip 1
Trip 2
Trip 3
...
Trip N
```

The number of rendered rows must be determined by the selected Trips.

The template must not require the Owner to manually create a fixed number of Trip rows.

---

# 21. Repeatable Sections

A repeatable section may contain multiple fields.

For example:

```text
| Trip No. | Date | Vehicle | From | To | Amount |
```

The complete row can repeat for every selected Trip.

A repeatable section must retain its:

- Column structure.
- Field mapping.
- Formatting.
- Borders.
- Alignment.

---

# 22. Multi-Page Rendering

The renderer must support Bills that extend beyond one page.

This is particularly important for Consolidated Bills.

The system must be able to:

- Continue repeatable rows on subsequent pages.
- Preserve table structure.
- Preserve headers/footers.
- Respect page breaks.
- Prevent content from being silently cut off.

---

# 23. Page Headers

Templates may contain a page header.

The header can contain:

- Company information.
- Logo.
- Static text.
- Dynamic fields.
- Other approved header content.

If configured as a repeating header, it must appear on applicable pages of a multi-page Bill.

---

# 24. Page Footers

Templates may contain a page footer.

The footer can contain:

- Static text.
- Dynamic fields.
- Page information.
- Signature/stamp content where configured.

The footer must remain part of the structured template.

---

# 25. Page Breaks

The editor must support explicit page breaks.

Page breaks may be used to control:

- Section separation.
- Signature placement.
- Summary placement.
- Multi-page Bill layout.

The renderer must also handle automatic page breaks when content exceeds the available page area.

---

# 26. Alignment and Spacing

Structured elements must support appropriate:

- Horizontal alignment.
- Vertical alignment where applicable.
- Margins.
- Padding.
- Spacing.
- Positioning.

The exact rendering engine is an implementation decision.

The output must preserve the intended layout of the saved template.

---

# 27. Images and Assets

The Bill Designer must support reusable billing assets.

Supported assets include:

- Company Logo.
- Stamp.
- Signature.
- Other approved billing images.

Assets must be stored separately where appropriate so that templates can reference them.

---

# 28. Asset Replacement

Replacing an asset must not silently alter previously generated historical Bills.

Historical Bill Versions must preserve their own generated document state.

Future rendering can use the current template/asset configuration according to the applicable Bill Version.

---

# 29. Template Assignment

A Company has one configured Billing Template at a time.

The Owner can assign a template to a Company.

Changing the configured template affects future Bills.

Existing Bills remain historically unchanged.

---

# 30. Individual Billing Template Behavior

For Individual Billing:

- Exactly one Trip is selected.
- Dynamic fields resolve against that Trip.
- Repeatable Trip sections contain one Trip where used.
- Bill amount comes from the selected Trip's approved billable amount.

---

# 31. Consolidated Billing Template Behavior

For Consolidated Billing:

- Multiple Trips are selected manually.
- Each selected Trip becomes a separate rendered item/row/section.
- Repeatable sections expand according to the number of selected Trips.
- The Bill may span multiple pages.
- The final Bill amount represents the sum of the selected billable Trip amounts.

---

# 32. Template Validation

Before a template is saved as usable, the system should validate that:

- Required structured elements are valid.
- Dynamic field references are valid.
- Repeatable sections are structurally valid.
- Tables are valid.
- Referenced assets are available.
- The template can be rendered.

Invalid dynamic references must not be silently ignored.

---

# 33. Template Preview

The Designer should provide a preview using representative application data.

The preview should demonstrate:

- Dynamic values.
- Tables.
- Repeatable rows.
- Page breaks.
- Headers.
- Footers.
- Images.
- Signatures.
- Stamps.

Preview data must not alter production records.

---

# 34. Template Rendering Test

Before a template is assigned for production billing, the Owner should be able to review its rendered output.

The rendered result must be checked for:

- Missing fields.
- Incorrect field mapping.
- Broken layout.
- Overflow.
- Incorrect page breaks.
- Missing assets.
- Incorrect repeatable rows.

---

# 35. Template Versioning

The Billing Template itself should be treated as structured configuration.

When the configured template changes, future Bills use the new template.

Existing Bill Versions must continue to reference the template/version used for their generation where required for reconstruction.

The system must not silently regenerate historical Bills using a newer template.

---

# 36. Bill Version and Template Relationship

A Bill Version must preserve its template reference.

Conceptually:

```text
Company
   ↓
Current Billing Template
   ↓
Bill Generation
   ↓
Bill Version
   ↓
Template Reference + Business Data
   ↓
Generated Bill
```

This allows the system to distinguish the template used for each generated version.

---

# 37. Generated PDF Relationship

The generated PDF is an output of:

```text
Bill Version
+
Structured Template
+
Business Data
+
Selected Trips
```

Deleting the generated PDF must not delete the structured Bill Version.

The PDF can be regenerated using the appropriate structured information.

---

# 38. Template Storage

The template must store structured information required to render the Bill.

It must not rely exclusively on:

- Screenshot.
- JPG.
- PNG.
- Flattened PDF background.

Reference images may be used during reconstruction, but the saved production template must be structured.

---

# 39. Dynamic Field Safety

Dynamic fields must resolve against authorized application data.

The template system must not allow arbitrary database queries or unrestricted code execution through template fields.

A dynamic field represents an approved application data reference.

---

# 40. Template Editing Authorization

Only the Owner can:

- Create production templates.
- Modify production templates.
- Assign templates to Companies.
- Change Company template configuration.

Staff can use configured templates for billing.

CA cannot modify templates.

---

# 41. Template and Billing Configuration

The Bill Designer is part of billing configuration.

Therefore:

- Template changes are Owner-only.
- Billing mode changes are Owner-only.
- Numbering series changes are Owner-only.
- Required billing field changes are Owner-only.
- TDS treatment changes are Owner-only.

The Bill Designer must not bypass these authorization rules.

---

# 42. Template and Required Fields

If a Company has configured required billing fields, the Bill generation workflow must validate them before rendering.

The Designer can reference the fields, but it does not decide whether they are required.

Required-field rules belong to Company Billing Configuration.

---

# 43. Template and TDS

The Designer may display TDS-related fields where the Company's billing configuration and underlying data require them.

The Designer must not independently calculate or alter TDS.

Actual TDS data comes from the approved financial workflow.

---

# 44. Template and Payment

The Bill Designer does not create payments.

Payment data displayed in a Bill must come from the authoritative Payment Module/approved Bill financial state.

The template must not create or modify Payment records.

---

# 45. Template and Trip Eligibility

The Bill Designer does not decide whether a Trip is eligible for billing.

Eligibility is determined by the Billing Module.

The Designer receives the selected eligible Trips and renders their data.

---

# 46. Template Error Handling

If a dynamic field cannot be resolved:

- The Bill should not silently display incorrect data.
- The missing field should be identifiable.
- Generation should be blocked when the missing field is required.
- The user should be directed to the relevant source record or configuration.

For optional fields, the rendering behavior must follow the configured template behavior.

---

# 47. Template Preview vs Production

Preview rendering must not:

- Create a Bill Number.
- Mark Trips as Billed.
- Create Payment records.
- Change Trip status.
- Change financial balances.
- Create audit records as if a production Bill was generated.

Production generation is a separate controlled workflow.

---

# 48. Production Bill Generation

When the Owner or authorized Staff user generates a production Bill:

1. Eligible Trips are selected.
2. Company billing configuration is loaded.
3. Numbering Series is selected.
4. Required fields are validated.
5. Template is loaded.
6. Dynamic fields are resolved.
7. Repeatable sections are expanded.
8. Bill amount is calculated from approved data.
9. Bill Number is generated.
10. Bill Version is created.
11. Generated document is produced.
12. Selected Trips become Billed.
13. Audit history is recorded.

The operation must be transactional so that partial Bill creation does not leave inconsistent Trip/Bill state.

---

# 49. Bill Designer Non-Negotiable Rules

1. Production templates are structured, not image-only.
2. Existing PDF/JPG/PNG references are automatically reconstructed into editable structure.
3. The Owner reviews and corrects reconstructed templates before use.
4. Dynamic fields must be available from the approved structured data model.
5. The Designer must not be limited to a tiny hard-coded field list.
6. Consolidated Bills must support repeatable Trip rows/sections.
7. Repeatable rows must support variable Trip counts.
8. Multi-page Bills must be supported.
9. Headers and footers must be supported.
10. Tables must be structured and editable.
11. Calculated fields must use authoritative application calculations.
12. The Designer must not create independent financial records.
13. The Designer must not create Payment records.
14. The Designer must not decide Trip billing eligibility.
15. Only Owner can modify production billing templates/configuration.
16. Existing generated Bill Versions must not silently change when templates are updated.
17. Generated PDFs are outputs of structured Bill Versions.
18. Deleting a generated PDF must not delete the Bill or its structured version.
19. Historical Bill Versions must remain readable/reconstructable according to the retention rules.
20. Template rendering must prevent silent data loss or incorrect dynamic-field resolution.
