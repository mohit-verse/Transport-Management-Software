export interface CanonicalDynamicField {
  source_entity:
    | 'PARTY'
    | 'TRIP'
    | 'VEHICLE'
    | 'VEHICLE_OWNER'
    | 'JOURNEY'
    | 'RECEIVABLES'
    | 'VEHICLE_OWNER_PAYABLES'
    | 'OWN_FLEET_EXPENSES'
    | 'POD'
    | 'ISSUES'
    | 'BILLING'
    | 'PAYMENT'
    | 'SYSTEM'
    | 'CALCULATED';
  field_key: string;
  field_label: string;
  data_type: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY' | 'JSON';
  is_repeatable: boolean;
}

export const CANONICAL_DYNAMIC_FIELDS: CanonicalDynamicField[] = [
  // 1. PARTY / COMPANY
  { source_entity: 'PARTY', field_key: 'name', field_label: 'Party / Company Name', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'primary_mobile', field_label: 'Primary Mobile Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'full_address', field_label: 'Full Address', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'city', field_label: 'City', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'state', field_label: 'State', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'pin_code', field_label: 'PIN Code', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'gstin', field_label: 'GSTIN', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'party_type', field_label: 'Party Type', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'billing_address', field_label: 'Billing Address', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'PARTY', field_key: 'tds_applicable', field_label: 'TDS Applicable', data_type: 'BOOLEAN', is_repeatable: false },

  // 2. TRIP
  { source_entity: 'TRIP', field_key: 'trip_number', field_label: 'Trip Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'trip_type', field_label: 'Trip Type', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'vehicle_relationship', field_label: 'Vehicle Relationship', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'driver_mobile_number', field_label: 'Driver Mobile Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'trip_date', field_label: 'Trip Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'loading_date', field_label: 'Loading Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'unloading_date', field_label: 'Unloading Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'origin', field_label: 'Origin Location', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'destination', field_label: 'Primary Destination', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'TRIP', field_key: 'status', field_label: 'Trip Status', data_type: 'STRING', is_repeatable: false },

  // 3. VEHICLE
  { source_entity: 'VEHICLE', field_key: 'vehicle_number', field_label: 'Vehicle Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'VEHICLE', field_key: 'vehicle_type', field_label: 'Vehicle Relationship Type', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'VEHICLE', field_key: 'vehicle_make', field_label: 'Vehicle Make / Category', data_type: 'STRING', is_repeatable: false },

  // 4. VEHICLE OWNER
  { source_entity: 'VEHICLE_OWNER', field_key: 'name', field_label: 'Vehicle Owner Name', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER', field_key: 'mobile_number', field_label: 'Vehicle Owner Mobile', data_type: 'STRING', is_repeatable: false },

  // 5. JOURNEY / DESTINATIONS
  { source_entity: 'JOURNEY', field_key: 'sequence_no', field_label: 'Destination Sequence Number', data_type: 'NUMBER', is_repeatable: true },
  { source_entity: 'JOURNEY', field_key: 'from_location', field_label: 'From Location', data_type: 'STRING', is_repeatable: true },
  { source_entity: 'JOURNEY', field_key: 'to_location', field_label: 'To Location', data_type: 'STRING', is_repeatable: true },
  { source_entity: 'JOURNEY', field_key: 'distance_km', field_label: 'Distance (km)', data_type: 'NUMBER', is_repeatable: true },
  { source_entity: 'JOURNEY', field_key: 'unloading_charge', field_label: 'Destination Unloading Charge', data_type: 'CURRENCY', is_repeatable: true },

  // 6. RECEIVABLES
  { source_entity: 'RECEIVABLES', field_key: 'freight_amount', field_label: 'Freight Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'detention_amount', field_label: 'Detention Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'unloading_amount', field_label: 'Unloading Charge Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'other_charges_amount', field_label: 'Other Charges Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'deductions_amount', field_label: 'Deductions Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'tds_amount', field_label: 'TDS Deducted Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'RECEIVABLES', field_key: 'receivable_amount', field_label: 'Net Receivable Amount', data_type: 'CURRENCY', is_repeatable: false },

  // 7. VEHICLE OWNER PAYABLES
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'freight_amount', field_label: 'Owner Freight Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'detention_amount', field_label: 'Owner Detention Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'unloading_amount', field_label: 'Owner Unloading Charge', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'other_charges_amount', field_label: 'Owner Other Charges', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'deductions_amount', field_label: 'Owner Deductions', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'VEHICLE_OWNER_PAYABLES', field_key: 'payable_amount', field_label: 'Net Payable Amount', data_type: 'CURRENCY', is_repeatable: false },

  // 8. OWN FLEET EXPENSES
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'diesel_amount', field_label: 'Diesel Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'fastag_amount', field_label: 'FASTag Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'border_amount', field_label: 'Border Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'loading_amount', field_label: 'Loading Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'unloading_amount', field_label: 'Unloading Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'other_amount', field_label: 'Other Fleet Expense', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'OWN_FLEET_EXPENSES', field_key: 'total_expense', field_label: 'Total Fleet Expenses', data_type: 'CURRENCY', is_repeatable: false },

  // 9. POD / LR / INVOICE
  { source_entity: 'POD', field_key: 'pod_status', field_label: 'POD Status', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'POD', field_key: 'lr_number', field_label: 'LR Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'POD', field_key: 'invoice_number', field_label: 'Invoice Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'POD', field_key: 'pod_received_at', field_label: 'POD Received Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'POD', field_key: 'docket_number', field_label: 'Courier Docket Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'POD', field_key: 'courier_partner', field_label: 'Courier Partner', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'POD', field_key: 'sent_to_party_at', field_label: 'Courier Sent Date', data_type: 'DATE', is_repeatable: false },

  // 10. ISSUES
  { source_entity: 'ISSUES', field_key: 'issue_type', field_label: 'Issue Type', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'ISSUES', field_key: 'issue_description', field_label: 'Issue Description', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'ISSUES', field_key: 'issue_status', field_label: 'Issue Status', data_type: 'STRING', is_repeatable: false },

  // 11. BILLING
  { source_entity: 'BILLING', field_key: 'bill_number', field_label: 'Bill Number', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'bill_date', field_label: 'Bill Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'billing_mode', field_label: 'Billing Mode', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'bill_status', field_label: 'Bill Status', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'version_label', field_label: 'Version Label', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'version_number', field_label: 'Version Number', data_type: 'NUMBER', is_repeatable: false },
  { source_entity: 'BILLING', field_key: 'financial_year_code', field_label: 'Financial Year Code', data_type: 'STRING', is_repeatable: false },

  // 12. PAYMENT
  { source_entity: 'PAYMENT', field_key: 'total_paid_amount', field_label: 'Total Paid Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'PAYMENT', field_key: 'balance_amount', field_label: 'Balance Outstanding Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'PAYMENT', field_key: 'paid_at', field_label: 'Bill Paid Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'PAYMENT', field_key: 'payment_status', field_label: 'Payment Status', data_type: 'STRING', is_repeatable: false },

  // 13. SYSTEM / BILL INFORMATION
  { source_entity: 'SYSTEM', field_key: 'company_name', field_label: 'SRL Business Name', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'company_tagline', field_label: 'SRL Tagline', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'company_address', field_label: 'SRL Registered Address', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'company_phone', field_label: 'SRL Contact Mobile', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'company_email', field_label: 'SRL Contact Email', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'company_gstin', field_label: 'SRL GSTIN', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'generation_date', field_label: 'Document Generation Date', data_type: 'DATE', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'page_number', field_label: 'Current Page Number', data_type: 'NUMBER', is_repeatable: false },
  { source_entity: 'SYSTEM', field_key: 'total_pages', field_label: 'Total Pages Count', data_type: 'NUMBER', is_repeatable: false },

  // 14. CALCULATED FIELDS
  { source_entity: 'CALCULATED', field_key: 'total_bill_amount', field_label: 'Total Bill Line Amount', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'CALCULATED', field_key: 'total_trips_count', field_label: 'Total Selected Trips Count', data_type: 'NUMBER', is_repeatable: false },
  { source_entity: 'CALCULATED', field_key: 'amount_in_words', field_label: 'Total Bill Amount in Words', data_type: 'STRING', is_repeatable: false },
  { source_entity: 'CALCULATED', field_key: 'subtotal_freight', field_label: 'Subtotal Freight', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'CALCULATED', field_key: 'total_unloading', field_label: 'Total Unloading Charges', data_type: 'CURRENCY', is_repeatable: false },
  { source_entity: 'CALCULATED', field_key: 'total_deductions', field_label: 'Total Trip Deductions', data_type: 'CURRENCY', is_repeatable: false }
];
