-- Canonical Dynamic Field Definitions Seed
-- Shri Sanwariya Road Lines (SSRL)
-- 14 source categories, 88 canonical fields

INSERT INTO dynamic_field_definitions (source_entity, field_key, field_label, data_type, is_repeatable, is_active)
VALUES
  -- 1. PARTY
  ('PARTY', 'name', 'Party / Company Name', 'STRING', false, true),
  ('PARTY', 'primary_mobile', 'Primary Mobile Number', 'STRING', false, true),
  ('PARTY', 'full_address', 'Full Address', 'STRING', false, true),
  ('PARTY', 'city', 'City', 'STRING', false, true),
  ('PARTY', 'state', 'State', 'STRING', false, true),
  ('PARTY', 'pin_code', 'PIN Code', 'STRING', false, true),
  ('PARTY', 'gstin', 'GSTIN', 'STRING', false, true),
  ('PARTY', 'party_type', 'Party Type', 'STRING', false, true),
  ('PARTY', 'billing_address', 'Billing Address', 'STRING', false, true),
  ('PARTY', 'tds_applicable', 'TDS Applicable', 'BOOLEAN', false, true),

  -- 2. TRIP
  ('TRIP', 'trip_number', 'Trip Number', 'STRING', false, true),
  ('TRIP', 'trip_type', 'Trip Type', 'STRING', false, true),
  ('TRIP', 'vehicle_relationship', 'Vehicle Relationship', 'STRING', false, true),
  ('TRIP', 'driver_mobile_number', 'Driver Mobile Number', 'STRING', false, true),
  ('TRIP', 'trip_date', 'Trip Date', 'DATE', false, true),
  ('TRIP', 'loading_date', 'Loading Date', 'DATE', false, true),
  ('TRIP', 'unloading_date', 'Unloading Date', 'DATE', false, true),
  ('TRIP', 'origin', 'Origin Location', 'STRING', false, true),
  ('TRIP', 'destination', 'Primary Destination', 'STRING', false, true),
  ('TRIP', 'status', 'Trip Status', 'STRING', false, true),

  -- 3. VEHICLE
  ('VEHICLE', 'vehicle_number', 'Vehicle Number', 'STRING', false, true),
  ('VEHICLE', 'vehicle_type', 'Vehicle Relationship Type', 'STRING', false, true),
  ('VEHICLE', 'vehicle_make', 'Vehicle Make / Category', 'STRING', false, true),

  -- 4. VEHICLE OWNER
  ('VEHICLE_OWNER', 'name', 'Vehicle Owner Name', 'STRING', false, true),
  ('VEHICLE_OWNER', 'mobile_number', 'Vehicle Owner Mobile', 'STRING', false, true),

  -- 5. JOURNEY
  ('JOURNEY', 'sequence_no', 'Destination Sequence Number', 'NUMBER', true, true),
  ('JOURNEY', 'from_location', 'From Location', 'STRING', true, true),
  ('JOURNEY', 'to_location', 'To Location', 'STRING', true, true),
  ('JOURNEY', 'distance_km', 'Distance (km)', 'NUMBER', true, true),
  ('JOURNEY', 'unloading_charge', 'Destination Unloading Charge', 'CURRENCY', true, true),

  -- 6. RECEIVABLES
  ('RECEIVABLES', 'freight_amount', 'Freight Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'detention_amount', 'Detention Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'unloading_amount', 'Unloading Charge Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'other_charges_amount', 'Other Charges Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'deductions_amount', 'Deductions Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'tds_amount', 'TDS Deducted Amount', 'CURRENCY', false, true),
  ('RECEIVABLES', 'receivable_amount', 'Net Receivable Amount', 'CURRENCY', false, true),

  -- 7. VEHICLE OWNER PAYABLES
  ('VEHICLE_OWNER_PAYABLES', 'freight_amount', 'Owner Freight Amount', 'CURRENCY', false, true),
  ('VEHICLE_OWNER_PAYABLES', 'detention_amount', 'Owner Detention Amount', 'CURRENCY', false, true),
  ('VEHICLE_OWNER_PAYABLES', 'unloading_amount', 'Owner Unloading Charge', 'CURRENCY', false, true),
  ('VEHICLE_OWNER_PAYABLES', 'other_charges_amount', 'Owner Other Charges', 'CURRENCY', false, true),
  ('VEHICLE_OWNER_PAYABLES', 'deductions_amount', 'Owner Deductions', 'CURRENCY', false, true),
  ('VEHICLE_OWNER_PAYABLES', 'payable_amount', 'Net Payable Amount', 'CURRENCY', false, true),

  -- 8. OWN FLEET EXPENSES
  ('OWN_FLEET_EXPENSES', 'diesel_amount', 'Diesel Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'fastag_amount', 'FASTag Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'border_amount', 'Border Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'loading_amount', 'Loading Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'unloading_amount', 'Unloading Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'other_amount', 'Other Fleet Expense', 'CURRENCY', false, true),
  ('OWN_FLEET_EXPENSES', 'total_expense', 'Total Fleet Expenses', 'CURRENCY', false, true),

  -- 9. POD
  ('POD', 'pod_status', 'POD Status', 'STRING', false, true),
  ('POD', 'lr_number', 'LR Number', 'STRING', false, true),
  ('POD', 'invoice_number', 'Invoice Number', 'STRING', false, true),
  ('POD', 'pod_received_at', 'POD Received Date', 'DATE', false, true),
  ('POD', 'docket_number', 'Courier Docket Number', 'STRING', false, true),
  ('POD', 'courier_partner', 'Courier Partner', 'STRING', false, true),
  ('POD', 'sent_to_party_at', 'Courier Sent Date', 'DATE', false, true),

  -- 10. ISSUES
  ('ISSUES', 'issue_type', 'Issue Type', 'STRING', false, true),
  ('ISSUES', 'issue_description', 'Issue Description', 'STRING', false, true),
  ('ISSUES', 'issue_status', 'Issue Status', 'STRING', false, true),

  -- 11. BILLING
  ('BILLING', 'bill_number', 'Bill Number', 'STRING', false, true),
  ('BILLING', 'bill_date', 'Bill Date', 'DATE', false, true),
  ('BILLING', 'billing_mode', 'Billing Mode', 'STRING', false, true),
  ('BILLING', 'bill_status', 'Bill Status', 'STRING', false, true),
  ('BILLING', 'version_label', 'Version Label', 'STRING', false, true),
  ('BILLING', 'version_number', 'Version Number', 'NUMBER', false, true),
  ('BILLING', 'financial_year_code', 'Financial Year Code', 'STRING', false, true),

  -- 12. PAYMENT
  ('PAYMENT', 'total_paid_amount', 'Total Paid Amount', 'CURRENCY', false, true),
  ('PAYMENT', 'balance_amount', 'Balance Outstanding Amount', 'CURRENCY', false, true),
  ('PAYMENT', 'paid_at', 'Bill Paid Date', 'DATE', false, true),
  ('PAYMENT', 'payment_status', 'Payment Status', 'STRING', false, true),

  -- 13. SYSTEM
  ('SYSTEM', 'company_name', 'SRL Business Name', 'STRING', false, true),
  ('SYSTEM', 'company_tagline', 'SRL Tagline', 'STRING', false, true),
  ('SYSTEM', 'company_address', 'SRL Registered Address', 'STRING', false, true),
  ('SYSTEM', 'company_phone', 'SRL Contact Mobile', 'STRING', false, true),
  ('SYSTEM', 'company_email', 'SRL Contact Email', 'STRING', false, true),
  ('SYSTEM', 'company_gstin', 'SRL GSTIN', 'STRING', false, true),
  ('SYSTEM', 'generation_date', 'Document Generation Date', 'DATE', false, true),
  ('SYSTEM', 'page_number', 'Current Page Number', 'NUMBER', false, true),
  ('SYSTEM', 'total_pages', 'Total Pages Count', 'NUMBER', false, true),

  -- 14. CALCULATED
  ('CALCULATED', 'total_bill_amount', 'Total Bill Line Amount', 'CURRENCY', false, true),
  ('CALCULATED', 'total_trips_count', 'Total Selected Trips Count', 'NUMBER', false, true),
  ('CALCULATED', 'amount_in_words', 'Total Bill Amount in Words', 'STRING', false, true),
  ('CALCULATED', 'subtotal_freight', 'Subtotal Freight', 'CURRENCY', false, true),
  ('CALCULATED', 'total_unloading', 'Total Unloading Charges', 'CURRENCY', false, true),
  ('CALCULATED', 'total_deductions', 'Total Trip Deductions', 'CURRENCY', false, true)
ON CONFLICT (source_entity, field_key) DO UPDATE
SET field_label = EXCLUDED.field_label,
    data_type = EXCLUDED.data_type,
    is_repeatable = EXCLUDED.is_repeatable,
    is_active = true,
    updated_at = now();
