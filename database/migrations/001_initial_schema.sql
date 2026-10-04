-- SRL Initial PostgreSQL Schema
-- Generated from database/SCHEMA_DESIGN.md
-- This migration represents the approved business model and keeps the financial source-of-truth rules intact.
-- Creation order is dependency-driven so PostgreSQL foreign keys resolve correctly on a clean database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('OWNER', 'STAFF', 'CA')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_mobile_number_chk CHECK (mobile_number ~ '^\+?[0-9]{10,15}$'),
    CONSTRAINT users_name_chk CHECK (name <> ''),
    CONSTRAINT users_mobile_unique UNIQUE (mobile_number)
);

CREATE TABLE user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    session_token_hash TEXT NOT NULL,
    refresh_token_hash TEXT NULL,
    device_info TEXT NULL,
    ip_address INET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_sessions_expires_after_created CHECK (expires_at > created_at),
    CONSTRAINT user_sessions_session_token_unique UNIQUE (session_token_hash),
    CONSTRAINT user_sessions_refresh_token_unique UNIQUE (refresh_token_hash)
);

CREATE TABLE financial_years (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT financial_years_code_unique UNIQUE (code),
    CONSTRAINT financial_years_date_unique UNIQUE (start_date, end_date),
    CONSTRAINT financial_years_date_range_chk CHECK (end_date >= start_date)
);

CREATE TABLE business_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key VARCHAR(120) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT NULL,
    updated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT business_settings_key_unique UNIQUE (setting_key),
    CONSTRAINT business_settings_key_chk CHECK (setting_key <> ''),
    CONSTRAINT business_settings_value_type_chk CHECK (jsonb_typeof(setting_value) IN ('object', 'array', 'string', 'number', 'boolean', 'null'))
);

CREATE TABLE dynamic_field_definitions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_entity VARCHAR(50) NOT NULL CHECK (source_entity IN ('PARTY', 'TRIP', 'VEHICLE', 'VEHICLE_OWNER', 'JOURNEY', 'RECEIVABLES', 'VEHICLE_OWNER_PAYABLES', 'OWN_FLEET_EXPENSES', 'POD', 'ISSUES', 'BILLING', 'PAYMENT', 'SYSTEM', 'CALCULATED')),
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,
    data_type VARCHAR(30) NOT NULL CHECK (data_type IN ('STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'CURRENCY', 'JSON')),
    is_repeatable BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dynamic_field_definitions_unique UNIQUE (source_entity, field_key),
    CONSTRAINT dynamic_field_definitions_key_chk CHECK (field_key <> ''),
    CONSTRAINT dynamic_field_definitions_label_chk CHECK (field_label <> '')
);

CREATE TABLE bill_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    template_type VARCHAR(30) NOT NULL CHECK (template_type IN ('INDIVIDUAL', 'CONSOLIDATED', 'MULTI_PAGE')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_templates_name_unique UNIQUE (name),
    CONSTRAINT bill_templates_layout_chk CHECK (jsonb_typeof(layout_json) = 'object')
);

CREATE TABLE bill_template_components (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES bill_templates(id) ON DELETE CASCADE,
    component_type VARCHAR(30) NOT NULL CHECK (component_type IN ('TEXT', 'TABLE', 'LINE', 'BORDER', 'IMAGE', 'LOGO', 'SIGNATURE', 'STAMP', 'HEADER', 'FOOTER', 'PAGE_BREAK', 'REPEATABLE_SECTION', 'REPEATABLE_ROW')),
    component_key VARCHAR(100) NOT NULL,
    position_x NUMERIC(10,2) NULL,
    position_y NUMERIC(10,2) NULL,
    width NUMERIC(10,2) NULL,
    height NUMERIC(10,2) NULL,
    style_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_template_components_unique UNIQUE (template_id, component_key),
    CONSTRAINT bill_template_components_style_chk CHECK (jsonb_typeof(style_json) = 'object'),
    CONSTRAINT bill_template_components_content_chk CHECK (jsonb_typeof(content_json) = 'object')
);

CREATE TABLE bill_template_dynamic_fields (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES bill_templates(id) ON DELETE CASCADE,
    field_definition_id UUID NOT NULL REFERENCES dynamic_field_definitions(id) ON DELETE RESTRICT,
    binding_path VARCHAR(200) NOT NULL,
    display_label VARCHAR(200) NULL,
    is_repeatable BOOLEAN NOT NULL DEFAULT false,
    default_value TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_template_dynamic_fields_unique UNIQUE (template_id, field_definition_id, binding_path),
    CONSTRAINT bill_template_dynamic_fields_binding_chk CHECK (binding_path <> '')
);

CREATE TABLE bill_template_assets (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES bill_templates(id) ON DELETE CASCADE,
    asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('LOGO', 'SIGNATURE', 'STAMP', 'IMAGE')),
    file_name VARCHAR(200) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    content_checksum VARCHAR(128) NOT NULL,
    mime_type VARCHAR(100) NULL,
    width NUMERIC(10,2) NULL,
    height NUMERIC(10,2) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_template_assets_unique UNIQUE (template_id, file_name),
    CONSTRAINT bill_template_assets_storage_key_chk CHECK (storage_key <> ''),
    CONSTRAINT bill_template_assets_checksum_chk CHECK (content_checksum <> '')
);

CREATE TABLE parties (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    primary_mobile VARCHAR(20) NOT NULL,
    full_address TEXT NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    pin_code VARCHAR(20) NULL,
    gstin VARCHAR(30) NULL,
    party_type VARCHAR(30) NOT NULL CHECK (party_type IN ('MARKET_PARTY', 'COMPANY')),
    billing_address TEXT NULL,
    tds_applicable BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT parties_name_chk CHECK (name <> ''),
    CONSTRAINT parties_mobile_chk CHECK (primary_mobile <> ''),
    CONSTRAINT parties_gstin_unique UNIQUE (gstin)
);

CREATE TABLE party_billing_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID NOT NULL UNIQUE REFERENCES parties(id) ON DELETE RESTRICT,
    billing_mode VARCHAR(30) NOT NULL CHECK (billing_mode IN ('INDIVIDUAL', 'CONSOLIDATED')),
    default_template_id UUID NULL REFERENCES bill_templates(id) ON DELETE SET NULL,
    tds_treatment VARCHAR(100) NULL,
    required_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    numbering_series_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT party_billing_configs_required_fields_chk CHECK (jsonb_typeof(required_fields) = 'object'),
    CONSTRAINT party_billing_configs_numbering_chk CHECK (jsonb_typeof(numbering_series_policy) = 'object')
);

CREATE TABLE vehicle_owners (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT vehicle_owners_name_chk CHECK (name <> ''),
    CONSTRAINT vehicle_owners_mobile_unique UNIQUE (mobile_number)
);

CREATE TABLE market_vehicles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number VARCHAR(50) NOT NULL,
    vehicle_owner_id UUID NOT NULL REFERENCES vehicle_owners(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT market_vehicles_vehicle_number_unique UNIQUE (vehicle_number),
    CONSTRAINT market_vehicles_number_chk CHECK (vehicle_number <> '')
);

CREATE TABLE own_fleet_vehicles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number VARCHAR(50) NOT NULL,
    manual_state VARCHAR(30) NULL CHECK (manual_state IN ('UNDER_MAINTENANCE', 'SOLD_REMOVED')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    maintenance_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT own_fleet_vehicles_number_unique UNIQUE (vehicle_number),
    CONSTRAINT own_fleet_vehicles_number_chk CHECK (vehicle_number <> '')
);

-- Own-fleet state is intentionally minimal and non-contradictory.
-- Persistent/manual states are limited to UNDER_MAINTENANCE and SOLD_REMOVED.
-- IN_TRIP and AVAILABLE are derived from active trip existence and maintenance status only.
-- AVAILABLE is never persisted as a manual state.

CREATE TABLE own_fleet_vehicle_status_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    own_fleet_vehicle_id UUID NOT NULL REFERENCES own_fleet_vehicles(id) ON DELETE RESTRICT,
    state_kind VARCHAR(20) NOT NULL CHECK (state_kind IN ('MANUAL', 'DERIVED')),
    previous_state VARCHAR(30) NULL,
    new_state VARCHAR(30) NOT NULL CHECK (new_state IN ('IN_TRIP', 'AVAILABLE', 'UNDER_MAINTENANCE', 'SOLD_REMOVED')),
    changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NULL,
    CONSTRAINT own_fleet_vehicle_status_history_state_chk CHECK (state_kind <> ''),
    CONSTRAINT own_fleet_vehicle_status_history_previous_state_chk CHECK (previous_state IS NULL OR previous_state IN ('IN_TRIP', 'AVAILABLE', 'UNDER_MAINTENANCE', 'SOLD_REMOVED'))
);

CREATE TABLE trips (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_number VARCHAR(100) NOT NULL,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    trip_type VARCHAR(20) NOT NULL CHECK (trip_type IN ('MARKET', 'COMPANY')),
    vehicle_relationship VARCHAR(20) NOT NULL CHECK (vehicle_relationship IN ('MARKET', 'OWN_FLEET')),
    market_vehicle_id UUID NULL REFERENCES market_vehicles(id) ON DELETE RESTRICT,
    own_fleet_vehicle_id UUID NULL REFERENCES own_fleet_vehicles(id) ON DELETE RESTRICT,
    vehicle_owner_id UUID NULL REFERENCES vehicle_owners(id) ON DELETE RESTRICT,
    driver_mobile_number VARCHAR(20) NULL,
    lr_number VARCHAR(100) NULL,
    invoice_number VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('CREATED', 'LOADING', 'IN_TRANSIT', 'COMPLETED', 'SETTLED', 'CANCELLED')),
    trip_date DATE NOT NULL,
    loading_date TIMESTAMPTZ NULL,
    unloading_date TIMESTAMPTZ NULL,
    origin VARCHAR(200) NULL,
    destination VARCHAR(200) NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trips_trip_number_unique UNIQUE (trip_number),
    CONSTRAINT trips_vehicle_rel_chk CHECK (
        (vehicle_relationship = 'MARKET' AND market_vehicle_id IS NOT NULL AND own_fleet_vehicle_id IS NULL)
        OR (vehicle_relationship = 'OWN_FLEET' AND own_fleet_vehicle_id IS NOT NULL AND market_vehicle_id IS NULL)
    ),
    CONSTRAINT trips_trip_type_chk CHECK (
        (trip_type = 'MARKET' AND market_vehicle_id IS NOT NULL)
        OR (trip_type = 'COMPANY' AND market_vehicle_id IS NOT NULL)
        OR (trip_type = 'COMPANY' AND own_fleet_vehicle_id IS NOT NULL)
    ),
    CONSTRAINT trips_trip_number_chk CHECK (trip_number <> '')
);

-- trip_pods is the authoritative record for all POD and courier facts.

CREATE TABLE trip_destinations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    from_location VARCHAR(200) NOT NULL,
    to_location VARCHAR(200) NOT NULL,
    distance_km NUMERIC(10,2) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_destinations_unique UNIQUE (trip_id, sequence_no),
    CONSTRAINT trip_destinations_trip_id_id_unique UNIQUE (trip_id, id),
    CONSTRAINT trip_destinations_distance_chk CHECK (distance_km IS NULL OR distance_km >= 0)
);

CREATE TABLE trip_party_financials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    freight_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    detention_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    tds_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    receivable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_party_financials_freight_chk CHECK (freight_amount >= 0),
    CONSTRAINT trip_party_financials_detention_chk CHECK (detention_amount >= 0),
    CONSTRAINT trip_party_financials_tds_chk CHECK (tds_amount >= 0)
);

CREATE TABLE trip_vehicle_owner_financials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    freight_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    detention_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_vehicle_owner_financials_freight_chk CHECK (freight_amount >= 0),
    CONSTRAINT trip_vehicle_owner_financials_detention_chk CHECK (detention_amount >= 0)
);

CREATE TABLE trip_other_charges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    side VARCHAR(20) NOT NULL CHECK (side IN ('PARTY', 'VEHICLE_OWNER')),
    charge_name VARCHAR(150) NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    remark TEXT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_other_charges_name_chk CHECK (charge_name <> '')
);

CREATE TABLE trip_deductions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    side VARCHAR(20) NOT NULL CHECK (side IN ('PARTY', 'VEHICLE_OWNER')),
    deduction_type VARCHAR(100) NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    remark TEXT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_deductions_type_chk CHECK (deduction_type <> '')
);

CREATE TABLE trip_unloading_charges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL,
    trip_destination_id UUID NOT NULL,
    side VARCHAR(20) NOT NULL CHECK (side IN ('PARTY', 'VEHICLE_OWNER')),
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    remark TEXT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_unloading_charges_unique UNIQUE (trip_destination_id, side),
    CONSTRAINT trip_unloading_charges_trip_fk FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE RESTRICT,
    CONSTRAINT trip_unloading_charges_trip_destination_fk FOREIGN KEY (trip_id, trip_destination_id) REFERENCES trip_destinations(trip_id, id) ON DELETE RESTRICT
);

CREATE TABLE trip_pods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    pod_status VARCHAR(30) NOT NULL CHECK (pod_status IN ('PENDING', 'RECEIVED', 'SENT', 'DISPATCHED')),
    docket_number VARCHAR(100) NULL,
    courier_partner VARCHAR(100) NULL,
    pod_received_at TIMESTAMPTZ NULL,
    sent_to_party_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_pods_trip_unique UNIQUE (trip_id),
    CONSTRAINT trip_pods_status_chk CHECK (pod_status <> '')
);

CREATE TABLE trip_issues (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    issue_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    reported_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT trip_issues_type_chk CHECK (issue_type <> '')
);

CREATE TABLE other_business_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_name VARCHAR(150) NOT NULL,
    category_type VARCHAR(20) NOT NULL CHECK (category_type IN ('PAYMENT', 'RECEIPT')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT other_business_categories_unique UNIQUE (category_name, category_type),
    CONSTRAINT other_business_categories_name_chk CHECK (category_name <> '')
);

CREATE TABLE payments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id VARCHAR(100) NOT NULL UNIQUE,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('INCOMING', 'OUTGOING')),
    category VARCHAR(40) NOT NULL CHECK (category IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT', 'OTHER_BUSINESS_RECEIPT', 'VEHICLE_OWNER_PAYMENT', 'OWN_FLEET_EXPENSE', 'OTHER_BUSINESS_PAYMENT')),
    other_business_category_id UUID NULL REFERENCES other_business_categories(id) ON DELETE RESTRICT,
    party_id UUID NULL REFERENCES parties(id) ON DELETE RESTRICT,
    vehicle_owner_id UUID NULL REFERENCES vehicle_owners(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(30) NOT NULL CHECK (payment_mode IN ('UPI', 'BANK_TRANSFER', 'CASH')),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('ACTIVE', 'REVERSED')),
    reversal_reason TEXT NULL,
    reversed_by UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    reversed_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    updated_by UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payments_status_reversal_chk CHECK (payment_status <> 'REVERSED' OR reversed_at IS NOT NULL),
    CONSTRAINT payments_type_category_chk CHECK (
        (payment_type = 'INCOMING' AND category IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT', 'OTHER_BUSINESS_RECEIPT'))
        OR (payment_type = 'OUTGOING' AND category IN ('VEHICLE_OWNER_PAYMENT', 'OWN_FLEET_EXPENSE', 'OTHER_BUSINESS_PAYMENT'))
    ),
    CONSTRAINT payments_other_business_chk CHECK (
        (category IN ('OTHER_BUSINESS_RECEIPT', 'OTHER_BUSINESS_PAYMENT') AND other_business_category_id IS NOT NULL)
        OR (category NOT IN ('OTHER_BUSINESS_RECEIPT', 'OTHER_BUSINESS_PAYMENT'))
    ),
    CONSTRAINT payments_party_entity_chk CHECK (
        (category IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT') AND party_id IS NOT NULL AND vehicle_owner_id IS NULL AND other_business_category_id IS NULL)
        OR (category = 'VEHICLE_OWNER_PAYMENT' AND vehicle_owner_id IS NOT NULL AND party_id IS NULL AND other_business_category_id IS NULL)
        OR (category = 'OWN_FLEET_EXPENSE' AND party_id IS NULL AND vehicle_owner_id IS NULL AND other_business_category_id IS NULL)
        OR (category IN ('OTHER_BUSINESS_RECEIPT', 'OTHER_BUSINESS_PAYMENT') AND other_business_category_id IS NOT NULL AND party_id IS NULL AND vehicle_owner_id IS NULL)
    ),
    CONSTRAINT payments_reversal_metadata_chk CHECK (
        (payment_status = 'ACTIVE' AND reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
        OR (payment_status = 'REVERSED' AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL AND reversal_reason IS NOT NULL AND reversal_reason <> '')
    )
);

-- Payment completeness is enforced by deferred constraint triggers after all transaction rows exist.
-- Active party-receipt allocations include BILL, TRIP, and CREDIT_GENERATED rows.
-- Reversed payment rows and their allocations remain in history but contribute zero.
-- Reversed payment rows remain in history but contribute zero to active financial totals.

CREATE TABLE own_fleet_expense_details (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    expense_category VARCHAR(30) NOT NULL CHECK (expense_category IN ('DIESEL', 'FASTAG', 'BORDER', 'LOADING', 'UNLOADING', 'OTHER')),
    expense_date DATE NOT NULL,
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    charge_name VARCHAR(150) NULL,
    remark TEXT NULL,
    trip_destination_id UUID NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT own_fleet_expense_details_charge_name_chk CHECK (charge_name IS NULL OR charge_name <> ''),
    CONSTRAINT own_fleet_expense_details_trip_destination_fk FOREIGN KEY (trip_id, trip_destination_id) REFERENCES trip_destinations(trip_id, id) ON DELETE RESTRICT
);

-- Expense details are context only. Payment linkage and split amounts are stored in payment_allocations.

CREATE TABLE bill_numbering_series (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    series_code VARCHAR(50) NOT NULL,
    prefix VARCHAR(50) NOT NULL,
    current_number INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_numbering_series_unique UNIQUE (party_id, financial_year_id, series_code),
    CONSTRAINT bill_numbering_series_current_number_chk CHECK (current_number >= 0),
    CONSTRAINT bill_numbering_series_prefix_chk CHECK (prefix <> ''),
    CONSTRAINT bill_numbering_series_code_chk CHECK (series_code <> '')
);

CREATE TABLE bills (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_number VARCHAR(100) NOT NULL,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    financial_year_id UUID NOT NULL REFERENCES financial_years(id) ON DELETE RESTRICT,
    bill_status VARCHAR(20) NOT NULL CHECK (bill_status IN ('GENERATED', 'SUBMITTED', 'PAID', 'CANCELLED')),
    billing_mode VARCHAR(30) NOT NULL CHECK (billing_mode IN ('INDIVIDUAL', 'CONSOLIDATED')),
    bill_date DATE NOT NULL,
    submitted_at TIMESTAMPTZ NULL,
    paid_at TIMESTAMPTZ NULL,
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    balance_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    cancel_reason TEXT NULL,
    cancelled_by UUID NULL REFERENCES users(id) ON DELETE RESTRICT,
    cancelled_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bills_bill_number_unique UNIQUE (bill_number, financial_year_id),
    CONSTRAINT bills_number_chk CHECK (bill_number <> ''),
    CONSTRAINT bills_submitted_at_chk CHECK (bill_status <> 'SUBMITTED' OR submitted_at IS NOT NULL),
    CONSTRAINT bills_total_chk CHECK (total_amount >= 0),
    CONSTRAINT bills_balance_chk CHECK (balance_amount >= 0),
    CONSTRAINT bills_cancel_no_reason_chk CHECK (bill_status <> 'CANCELLED' OR cancel_reason IS NOT NULL),
    CONSTRAINT bills_cancel_actor_chk CHECK (bill_status <> 'CANCELLED' OR cancelled_by IS NOT NULL),
    CONSTRAINT bills_cancel_time_chk CHECK (bill_status <> 'CANCELLED' OR cancelled_at IS NOT NULL)
);

CREATE TABLE bill_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    trip_id UUID NULL REFERENCES trips(id) ON DELETE RESTRICT,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    description TEXT NOT NULL,
    quantity NUMERIC(18,2) NULL,
    unit_price NUMERIC(18,2) NULL,
    line_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_items_unique UNIQUE (bill_id, sequence_no),
    CONSTRAINT bill_items_line_amount_chk CHECK (line_amount >= 0),
    CONSTRAINT bill_items_unit_price_chk CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT bill_items_quantity_chk CHECK (quantity IS NULL OR quantity >= 0)
);

CREATE TABLE bill_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    version_label VARCHAR(20) NOT NULL,
    version_status VARCHAR(20) NOT NULL CHECK (version_status IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED')),
    template_id UUID NULL REFERENCES bill_templates(id) ON DELETE SET NULL,
    template_snapshot JSONB NOT NULL,
    header_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    totals_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    resolved_dynamic_fields JSONB NULL,
    document_reference VARCHAR(255) NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_versions_unique UNIQUE (bill_id, version_number),
    CONSTRAINT bill_versions_template_snapshot_chk CHECK (
        jsonb_typeof(template_snapshot) = 'object'
        AND template_snapshot ?& ARRAY['layout', 'components', 'assets', 'dynamic_field_definitions']
        AND jsonb_typeof(template_snapshot -> 'layout') = 'object'
        AND jsonb_typeof(template_snapshot -> 'components') = 'array'
        AND jsonb_typeof(template_snapshot -> 'assets') = 'array'
        AND jsonb_typeof(template_snapshot -> 'dynamic_field_definitions') = 'array'
    ),
    CONSTRAINT bill_versions_header_chk CHECK (jsonb_typeof(header_snapshot) = 'object'),
    CONSTRAINT bill_versions_totals_chk CHECK (jsonb_typeof(totals_snapshot) = 'object'),
    CONSTRAINT bill_versions_label_chk CHECK (version_label <> '')
);

-- Historical bill versions must be reproducible even when the current template later changes.
-- template_snapshot stores the immutable layout/template state used to recreate the historical bill version.

CREATE TABLE bill_version_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bill_version_id UUID NOT NULL REFERENCES bill_versions(id) ON DELETE RESTRICT,
    trip_id UUID NULL REFERENCES trips(id) ON DELETE RESTRICT,
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    description TEXT NOT NULL,
    quantity NUMERIC(18,2) NULL,
    unit_price NUMERIC(18,2) NULL,
    line_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bill_version_items_unique UNIQUE (bill_version_id, sequence_no),
    CONSTRAINT bill_version_items_line_amount_chk CHECK (line_amount >= 0),
    CONSTRAINT bill_version_items_unit_price_chk CHECK (unit_price IS NULL OR unit_price >= 0),
    CONSTRAINT bill_version_items_quantity_chk CHECK (quantity IS NULL OR quantity >= 0)
);

CREATE TABLE payment_allocations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID NULL REFERENCES payments(id) ON DELETE RESTRICT, -- NULL only for credit use without a cash-payment context
    bill_id UUID NULL REFERENCES bills(id) ON DELETE RESTRICT,
    trip_id UUID NULL REFERENCES trips(id) ON DELETE RESTRICT,
    own_fleet_expense_detail_id UUID NULL REFERENCES own_fleet_expense_details(id) ON DELETE RESTRICT,
    vehicle_owner_id UUID NULL REFERENCES vehicle_owners(id) ON DELETE RESTRICT,
    party_credit_source_id UUID NULL REFERENCES payment_allocations(id) ON DELETE RESTRICT,
    allocation_type VARCHAR(40) NOT NULL CHECK (allocation_type IN ('BILL', 'TRIP', 'CREDIT_GENERATED', 'CREDIT_UTILIZED', 'VEHICLE_OWNER', 'OWN_FLEET_EXPENSE', 'OTHER_BUSINESS')),
    allocation_amount NUMERIC(18,2) NOT NULL CHECK (allocation_amount > 0),
    allocation_status VARCHAR(20) NOT NULL CHECK (allocation_status IN ('ACTIVE', 'REVERSED')),
    reversed_at TIMESTAMPTZ NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_allocations_allocation_type_chk CHECK (
        (allocation_type = 'BILL' AND bill_id IS NOT NULL AND trip_id IS NULL AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NULL)
        OR (allocation_type = 'TRIP' AND bill_id IS NULL AND trip_id IS NOT NULL AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NULL)
        OR (allocation_type = 'CREDIT_GENERATED' AND bill_id IS NULL AND trip_id IS NULL AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NULL)
        OR (allocation_type = 'CREDIT_UTILIZED' AND ((bill_id IS NOT NULL AND trip_id IS NULL) OR (bill_id IS NULL AND trip_id IS NOT NULL)) AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NOT NULL)
        OR (allocation_type = 'VEHICLE_OWNER' AND bill_id IS NULL AND trip_id IS NULL AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NOT NULL AND party_credit_source_id IS NULL)
        OR (allocation_type = 'OWN_FLEET_EXPENSE' AND bill_id IS NULL AND trip_id IS NULL AND own_fleet_expense_detail_id IS NOT NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NULL)
        OR (allocation_type = 'OTHER_BUSINESS' AND bill_id IS NULL AND trip_id IS NULL AND own_fleet_expense_detail_id IS NULL AND vehicle_owner_id IS NULL AND party_credit_source_id IS NULL)
    ),
    CONSTRAINT payment_allocations_payment_required_chk CHECK (allocation_type = 'CREDIT_UTILIZED' OR payment_id IS NOT NULL),
    CONSTRAINT payment_allocations_credit_source_not_self_chk CHECK (party_credit_source_id IS DISTINCT FROM id),
    CONSTRAINT payment_allocations_status_chk CHECK (allocation_status <> 'REVERSED' OR reversed_at IS NOT NULL)
);

-- payment_allocations is the authoritative financial allocation table.
-- payment_fifo_runs and payment_fifo_run_allocations are execution/audit detail only.
-- The same monetary value must appear once in payment_allocations and never be re-counted in FIFO execution rows.

CREATE TABLE payment_allocation_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    allocation_id UUID NOT NULL REFERENCES payment_allocations(id) ON DELETE RESTRICT,
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('CREATED', 'EDITED', 'REVERSED', 'REALLOCATED', 'FIFO_ALLOCATED')),
    previous_amount NUMERIC(18,2) NULL,
    new_amount NUMERIC(18,2) NULL,
    event_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NULL,
    CONSTRAINT payment_allocation_history_previous_chk CHECK (previous_amount IS NULL OR previous_amount >= 0),
    CONSTRAINT payment_allocation_history_new_chk CHECK (new_amount IS NULL OR new_amount >= 0)
);

CREATE TABLE payment_fifo_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    run_number INTEGER NOT NULL CHECK (run_number > 0),
    run_status VARCHAR(20) NOT NULL CHECK (run_status IN ('ACTIVE', 'PARTIAL', 'COMPLETED', 'REVERSED')),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_fifo_runs_unique UNIQUE (payment_id, run_number),
    CONSTRAINT payment_fifo_runs_unique_status_chk CHECK (run_status <> '')
);

CREATE TABLE payment_fifo_run_allocations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    fifo_run_id UUID NOT NULL REFERENCES payment_fifo_runs(id) ON DELETE RESTRICT,
    allocation_id UUID NOT NULL REFERENCES payment_allocations(id) ON DELETE RESTRICT,
    target_trip_id UUID NULL REFERENCES trips(id) ON DELETE RESTRICT,
    target_bill_id UUID NULL REFERENCES bills(id) ON DELETE RESTRICT,
    allocation_sequence INTEGER NOT NULL CHECK (allocation_sequence > 0),
    receivable_before NUMERIC(18,2) NOT NULL DEFAULT 0,
    receivable_after NUMERIC(18,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT payment_fifo_run_allocations_unique UNIQUE (fifo_run_id, allocation_sequence),
    CONSTRAINT payment_fifo_run_allocations_allocation_unique UNIQUE (allocation_id),
    CONSTRAINT payment_fifo_run_allocations_target_chk CHECK ((target_trip_id IS NOT NULL AND target_bill_id IS NULL) OR (target_trip_id IS NULL AND target_bill_id IS NOT NULL) OR (target_trip_id IS NULL AND target_bill_id IS NULL)),
    CONSTRAINT payment_fifo_run_allocations_snapshot_chk CHECK (receivable_before >= 0 AND receivable_after >= 0)
);

CREATE TABLE party_credits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    party_id UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    credit_allocation_id UUID NOT NULL UNIQUE REFERENCES payment_allocations(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT party_credits_source_payment_unique UNIQUE (payment_id)
);

-- Credit balances are computed from active CREDIT_GENERATED allocations less active
-- CREDIT_UTILIZED allocations. This identity table carries no independent money value.

CREATE TABLE documents (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_type VARCHAR(60) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    storage_provider VARCHAR(50) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NULL,
    file_size_bytes BIGINT NULL,
    checksum VARCHAR(128) NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT documents_storage_unique UNIQUE (storage_provider, storage_key),
    CONSTRAINT documents_file_size_chk CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    CONSTRAINT documents_original_name_chk CHECK (original_name <> ''),
    CONSTRAINT documents_storage_key_chk CHECK (storage_key <> '')
);

CREATE TABLE document_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    link_type VARCHAR(50) NOT NULL DEFAULT 'ATTACHMENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT document_links_unique UNIQUE (document_id, entity_type, entity_id, link_type),
    CONSTRAINT document_links_entity_chk CHECK (entity_type <> '')
);

CREATE TABLE audit_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(80) NOT NULL,
    module_name VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    entity_reference VARCHAR(200) NULL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    before_state JSONB NULL,
    after_state JSONB NULL,
    reason TEXT NULL,
    ip_address INET NULL,
    CONSTRAINT audit_events_action_chk CHECK (action_type <> ''),
    CONSTRAINT audit_events_module_chk CHECK (module_name <> ''),
    CONSTRAINT audit_events_entity_chk CHECK (entity_type <> '')
);

CREATE FUNCTION guard_trip_financial_cache() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF pg_trigger_depth() = 1 THEN
        IF TG_TABLE_NAME = 'trip_party_financials' THEN
            IF TG_OP = 'INSERT' AND NEW.receivable_amount <> 0 THEN
                RAISE EXCEPTION 'Trip financial totals are derived and cannot be supplied directly';
            ELSIF TG_OP = 'UPDATE' AND NEW.receivable_amount IS DISTINCT FROM OLD.receivable_amount THEN
                RAISE EXCEPTION 'Trip financial totals are derived and cannot be supplied directly';
            END IF;
        ELSIF TG_OP = 'INSERT' AND NEW.payable_amount <> 0 THEN
            RAISE EXCEPTION 'Trip financial totals are derived and cannot be supplied directly';
        ELSIF TG_OP = 'UPDATE' AND NEW.payable_amount IS DISTINCT FROM OLD.payable_amount THEN
            RAISE EXCEPTION 'Trip financial totals are derived and cannot be supplied directly';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION recalculate_trip_financials(p_trip_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    party_net NUMERIC(18,2);
    owner_net NUMERIC(18,2);
BEGIN
    SELECT COALESCE(pf.freight_amount, 0) + COALESCE(pf.detention_amount, 0)
        + COALESCE((SELECT SUM(uc.amount) FROM trip_unloading_charges uc WHERE uc.trip_id = p_trip_id AND uc.side = 'PARTY'), 0)
        + COALESCE((SELECT SUM(oc.amount) FROM trip_other_charges oc WHERE oc.trip_id = p_trip_id AND oc.side = 'PARTY'), 0)
        - COALESCE((SELECT SUM(d.amount) FROM trip_deductions d WHERE d.trip_id = p_trip_id AND d.side = 'PARTY'), 0)
        - COALESCE(pf.tds_amount, 0)
      INTO party_net
      FROM trips t LEFT JOIN trip_party_financials pf ON pf.trip_id = t.id
     WHERE t.id = p_trip_id;

    SELECT COALESCE(vf.freight_amount, 0) + COALESCE(vf.detention_amount, 0)
        + COALESCE((SELECT SUM(uc.amount) FROM trip_unloading_charges uc WHERE uc.trip_id = p_trip_id AND uc.side = 'VEHICLE_OWNER'), 0)
        + COALESCE((SELECT SUM(oc.amount) FROM trip_other_charges oc WHERE oc.trip_id = p_trip_id AND oc.side = 'VEHICLE_OWNER'), 0)
        - COALESCE((SELECT SUM(d.amount) FROM trip_deductions d WHERE d.trip_id = p_trip_id AND d.side = 'VEHICLE_OWNER'), 0)
      INTO owner_net
      FROM trips t LEFT JOIN trip_vehicle_owner_financials vf ON vf.trip_id = t.id
     WHERE t.id = p_trip_id;

    PERFORM set_config('srl.recalculating', 'on', true);
    UPDATE trip_party_financials SET receivable_amount = party_net, updated_at = now() WHERE trip_id = p_trip_id;
    UPDATE trip_vehicle_owner_financials SET payable_amount = owner_net, updated_at = now() WHERE trip_id = p_trip_id;
    PERFORM set_config('srl.recalculating', 'off', true);
END;
$$;

CREATE FUNCTION refresh_trip_financial_cache() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN PERFORM recalculate_trip_financials(OLD.trip_id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM recalculate_trip_financials(NEW.trip_id); END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION guard_bill_derived_values() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF pg_trigger_depth() = 1 THEN
        IF TG_OP = 'INSERT' AND (NEW.total_amount <> 0 OR NEW.balance_amount <> 0 OR NEW.paid_at IS NOT NULL OR NEW.bill_status = 'PAID') THEN
            RAISE EXCEPTION 'Bill totals, balance, paid_at, and PAID status are derived';
        ELSIF TG_OP = 'UPDATE' AND (
            NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
            NEW.balance_amount IS DISTINCT FROM OLD.balance_amount OR
            NEW.paid_at IS DISTINCT FROM OLD.paid_at OR
            (NEW.bill_status = 'PAID' AND OLD.bill_status IS DISTINCT FROM 'PAID')
        ) THEN
            RAISE EXCEPTION 'Bill totals, balance, paid_at, and PAID status are derived';
        END IF;
        IF TG_OP = 'UPDATE' AND NEW.bill_status IS DISTINCT FROM OLD.bill_status AND NOT (
            (OLD.bill_status = 'GENERATED' AND NEW.bill_status IN ('SUBMITTED', 'CANCELLED'))
            OR (OLD.bill_status = 'SUBMITTED' AND NEW.bill_status = 'CANCELLED')
        ) THEN
            RAISE EXCEPTION 'Bill status transition is not permitted';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION recalculate_bill(p_bill_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    bill_total NUMERIC(18,2);
    allocated_total NUMERIC(18,2);
    next_status VARCHAR(20);
    next_paid_at TIMESTAMPTZ;
    bill_submitted_at TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(SUM(bi.line_amount), 0) INTO bill_total
      FROM bill_items bi WHERE bi.bill_id = p_bill_id AND bi.is_active;
        SELECT COALESCE(SUM(pa.allocation_amount), 0) INTO allocated_total
            FROM payment_allocations pa
         WHERE pa.bill_id = p_bill_id AND pa.allocation_status = 'ACTIVE'
             AND (
                     (pa.allocation_type = 'BILL' AND EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id AND p.payment_status = 'ACTIVE'))
                     OR (pa.allocation_type = 'CREDIT_UTILIZED' AND EXISTS (
                             SELECT 1 FROM payment_allocations source
                             JOIN payments source_payment ON source_payment.id = source.payment_id
                             WHERE source.id = pa.party_credit_source_id AND source.allocation_type = 'CREDIT_GENERATED'
                                 AND source.allocation_status = 'ACTIVE' AND source_payment.payment_status = 'ACTIVE'
                     ))
             );

    SELECT bill_status, paid_at, submitted_at INTO next_status, next_paid_at, bill_submitted_at FROM bills WHERE id = p_bill_id;
    IF NOT FOUND THEN RETURN; END IF;
    IF next_status <> 'CANCELLED' THEN
        IF bill_total > 0 AND allocated_total >= bill_total THEN
            next_status := 'PAID';
            next_paid_at := COALESCE(next_paid_at, now());
        ELSE
            next_status := CASE WHEN bill_submitted_at IS NOT NULL THEN 'SUBMITTED' ELSE 'GENERATED' END;
            next_paid_at := NULL;
        END IF;
    ELSE
        next_paid_at := NULL;
    END IF;
    PERFORM set_config('srl.recalculating', 'on', true);
    UPDATE bills SET total_amount = bill_total,
        balance_amount = GREATEST(bill_total - allocated_total, 0),
        paid_at = next_paid_at, bill_status = next_status, updated_at = now()
     WHERE id = p_bill_id;
    PERFORM set_config('srl.recalculating', 'off', true);
END;
$$;

CREATE FUNCTION bill_item_set_active() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE((SELECT bill_status = 'CANCELLED' FROM bills WHERE id = NEW.bill_id), true) THEN
        RAISE EXCEPTION 'Bill items cannot be added to a cancelled bill';
    END IF;
    NEW.is_active := true;
    RETURN NEW;
END;
$$;

CREATE FUNCTION guard_bill_item_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF pg_trigger_depth() = 1 AND (
        NEW.is_active IS DISTINCT FROM OLD.is_active
        OR EXISTS (SELECT 1 FROM bills WHERE id = OLD.bill_id AND bill_status = 'CANCELLED')
    ) THEN
        RAISE EXCEPTION 'Bill-item activity is managed by bill status and cannot be edited directly';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION sync_bill_item_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.bill_status = 'CANCELLED' AND OLD.bill_status <> 'CANCELLED' THEN
        UPDATE bill_items SET is_active = false WHERE bill_id = NEW.id;
    ELSIF NEW.bill_status <> 'CANCELLED' AND OLD.bill_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cancelled bills cannot be restored';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION refresh_bill_cache_from_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    affected_bill UUID;
BEGIN
    IF TG_TABLE_NAME = 'bill_items' THEN
        IF TG_OP <> 'INSERT' THEN PERFORM recalculate_bill(OLD.bill_id); END IF;
        IF TG_OP <> 'DELETE' THEN PERFORM recalculate_bill(NEW.bill_id); END IF;
    ELSIF TG_TABLE_NAME = 'payment_allocations' THEN
        IF TG_OP <> 'INSERT' AND OLD.bill_id IS NOT NULL THEN PERFORM recalculate_bill(OLD.bill_id); END IF;
        IF TG_OP <> 'DELETE' AND NEW.bill_id IS NOT NULL THEN PERFORM recalculate_bill(NEW.bill_id); END IF;
    ELSIF TG_TABLE_NAME = 'payments' THEN
        FOR affected_bill IN SELECT DISTINCT bill_id FROM payment_allocations WHERE payment_id = NEW.id AND bill_id IS NOT NULL
        LOOP PERFORM recalculate_bill(affected_bill); END LOOP;
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION reverse_payment_allocations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.payment_status = 'ACTIVE' AND NEW.payment_status = 'REVERSED' THEN
        UPDATE payment_allocations SET allocation_status = 'REVERSED', reversed_at = NEW.reversed_at, updated_at = now()
         WHERE payment_id = NEW.id AND allocation_status = 'ACTIVE' AND allocation_type <> 'CREDIT_UTILIZED';
        UPDATE payment_allocations SET allocation_status = 'REVERSED', reversed_at = NEW.reversed_at, updated_at = now()
         WHERE payment_id = NEW.id AND allocation_status = 'ACTIVE' AND allocation_type = 'CREDIT_UTILIZED';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION validate_payment_integrity(p_payment_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    payment_row payments%ROWTYPE;
    accounted NUMERIC(18,2);
    invalid_count INTEGER;
    category_kind VARCHAR(20);
BEGIN
    SELECT * INTO payment_row FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RETURN; END IF;

    IF payment_row.category IN ('OTHER_BUSINESS_RECEIPT', 'OTHER_BUSINESS_PAYMENT') THEN
        SELECT category_type INTO category_kind FROM other_business_categories WHERE id = payment_row.other_business_category_id;
        IF category_kind IS DISTINCT FROM (CASE WHEN payment_row.category = 'OTHER_BUSINESS_RECEIPT' THEN 'RECEIPT' ELSE 'PAYMENT' END) THEN
            RAISE EXCEPTION 'Other-business payment category type does not match payment entity';
        END IF;
    END IF;
    IF payment_row.category IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT') AND NOT EXISTS (
        SELECT 1 FROM parties WHERE id = payment_row.party_id
          AND party_type = CASE WHEN payment_row.category = 'COMPANY_PAYMENT' THEN 'COMPANY' ELSE 'MARKET_PARTY' END
    ) THEN
        RAISE EXCEPTION 'Party type does not match payment category';
    END IF;

    SELECT COUNT(*) INTO invalid_count
      FROM payment_allocations pa
     WHERE pa.payment_id = p_payment_id AND pa.allocation_status = 'ACTIVE'
       AND (
        (pa.allocation_type = 'BILL' AND (payment_row.payment_type <> 'INCOMING' OR payment_row.party_id IS NULL OR NOT EXISTS (SELECT 1 FROM bills b WHERE b.id = pa.bill_id AND b.party_id = payment_row.party_id AND b.bill_status <> 'CANCELLED')))
        OR (pa.allocation_type = 'TRIP' AND NOT EXISTS (
            SELECT 1 FROM trips t WHERE t.id = pa.trip_id AND (
                (payment_row.payment_type = 'INCOMING' AND t.party_id = payment_row.party_id AND payment_row.category IN ('COMPANY_PAYMENT','MARKET_PARTY_PAYMENT'))
                OR (payment_row.payment_type = 'OUTGOING' AND payment_row.category = 'VEHICLE_OWNER_PAYMENT' AND t.vehicle_relationship = 'MARKET' AND t.vehicle_owner_id = payment_row.vehicle_owner_id)
            )))
                OR (pa.allocation_type = 'CREDIT_GENERATED' AND (payment_row.payment_type <> 'INCOMING' OR payment_row.category NOT IN ('COMPANY_PAYMENT','MARKET_PARTY_PAYMENT') OR NOT EXISTS (
                        SELECT 1 FROM party_credits pc
                        WHERE pc.credit_allocation_id = pa.id AND pc.party_id = payment_row.party_id AND pc.payment_id = p_payment_id
                )))
                OR (pa.allocation_type = 'CREDIT_UTILIZED' AND (payment_row.payment_type <> 'INCOMING' OR payment_row.category NOT IN ('COMPANY_PAYMENT','MARKET_PARTY_PAYMENT') OR NOT EXISTS (
                        SELECT 1
                            FROM payment_allocations source
                            JOIN payments source_payment ON source_payment.id = source.payment_id AND source_payment.payment_status = 'ACTIVE'
                            JOIN party_credits credit ON credit.credit_allocation_id = source.id
                         WHERE source.id = pa.party_credit_source_id
                             AND source.allocation_type = 'CREDIT_GENERATED'
                             AND source.allocation_status = 'ACTIVE'
                             AND source_payment.category IN ('COMPANY_PAYMENT','MARKET_PARTY_PAYMENT')
                             AND credit.party_id = source_payment.party_id
                             AND credit.payment_id = source.payment_id
                             AND ((pa.bill_id IS NOT NULL AND EXISTS (SELECT 1 FROM bills b WHERE b.id = pa.bill_id AND b.party_id = source_payment.party_id))
                                 OR (pa.trip_id IS NOT NULL AND EXISTS (SELECT 1 FROM trips t WHERE t.id = pa.trip_id AND t.party_id = source_payment.party_id)))
                             AND payment_row.party_id = source_payment.party_id
                )))
        OR (pa.allocation_type = 'VEHICLE_OWNER' AND (payment_row.payment_type <> 'OUTGOING' OR payment_row.category <> 'VEHICLE_OWNER_PAYMENT' OR pa.vehicle_owner_id IS DISTINCT FROM payment_row.vehicle_owner_id))
        OR (pa.allocation_type = 'OWN_FLEET_EXPENSE' AND (payment_row.payment_type <> 'OUTGOING' OR payment_row.category <> 'OWN_FLEET_EXPENSE' OR NOT EXISTS (SELECT 1 FROM own_fleet_expense_details e JOIN trips t ON t.id = e.trip_id WHERE e.id = pa.own_fleet_expense_detail_id AND t.vehicle_relationship = 'OWN_FLEET')))
        OR (pa.allocation_type = 'OTHER_BUSINESS' AND (payment_row.category NOT IN ('OTHER_BUSINESS_RECEIPT','OTHER_BUSINESS_PAYMENT')))
       );
    IF invalid_count > 0 THEN RAISE EXCEPTION 'Payment allocation target does not match payment entity'; END IF;

    IF EXISTS (
        SELECT 1 FROM payment_allocations source
        WHERE source.payment_id = p_payment_id AND source.allocation_type = 'CREDIT_GENERATED' AND source.allocation_status = 'ACTIVE'
                    AND (SELECT COALESCE(SUM(used.allocation_amount), 0) FROM payment_allocations used
                             WHERE used.party_credit_source_id = source.id
                                 AND used.allocation_type = 'CREDIT_UTILIZED'
                                 AND used.allocation_status = 'ACTIVE'
                                 AND (used.payment_id IS NULL OR EXISTS (SELECT 1 FROM payments context_payment WHERE context_payment.id = used.payment_id AND context_payment.payment_status = 'ACTIVE'))) > source.allocation_amount
    ) THEN RAISE EXCEPTION 'Party credit utilization exceeds generated credit'; END IF;

    IF payment_row.payment_status = 'REVERSED' THEN
        IF EXISTS (SELECT 1 FROM payment_allocations WHERE payment_id = p_payment_id AND allocation_status = 'ACTIVE') THEN
            RAISE EXCEPTION 'Reversed payment cannot have active allocations';
        END IF;
        RETURN;
    END IF;

    IF payment_row.payment_type = 'INCOMING' THEN
        IF payment_row.category IN ('COMPANY_PAYMENT','MARKET_PARTY_PAYMENT') THEN
            SELECT COALESCE(SUM(allocation_amount), 0) INTO accounted FROM payment_allocations
             WHERE payment_id = p_payment_id AND allocation_status = 'ACTIVE'
               AND allocation_type IN ('BILL','TRIP','CREDIT_GENERATED');
        ELSE
            SELECT COALESCE(SUM(allocation_amount), 0) INTO accounted FROM payment_allocations
             WHERE payment_id = p_payment_id AND allocation_status = 'ACTIVE' AND allocation_type = 'OTHER_BUSINESS';
        END IF;
    ELSE
        SELECT COALESCE(SUM(allocation_amount), 0) INTO accounted FROM payment_allocations
         WHERE payment_id = p_payment_id AND allocation_status = 'ACTIVE'
           AND allocation_type IN ('TRIP','VEHICLE_OWNER','OWN_FLEET_EXPENSE','OTHER_BUSINESS');
    END IF;
    IF accounted <> payment_row.amount THEN
        RAISE EXCEPTION 'Active payment allocations must account for exactly payment amount %, found %', payment_row.amount, accounted;
    END IF;
END;
$$;

CREATE FUNCTION guard_payment_entity_type_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'parties' AND NEW.party_type IS DISTINCT FROM OLD.party_type AND EXISTS (
        SELECT 1 FROM payments WHERE party_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'Party type cannot change after payments reference the party';
    END IF;
    IF TG_TABLE_NAME = 'other_business_categories' AND NEW.category_type IS DISTINCT FROM OLD.category_type AND EXISTS (
        SELECT 1 FROM payments WHERE other_business_category_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'Other-business category type cannot change after payments reference it';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION validate_credit_utilization(p_allocation_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    utilization_row payment_allocations%ROWTYPE;
    source_row payment_allocations%ROWTYPE;
    source_payment payments%ROWTYPE;
    target_party_id UUID;
    used_total NUMERIC(18,2);
BEGIN
    SELECT * INTO utilization_row FROM payment_allocations WHERE id = p_allocation_id;
    IF NOT FOUND OR utilization_row.allocation_type <> 'CREDIT_UTILIZED' OR utilization_row.allocation_status <> 'ACTIVE' THEN
        RETURN;
    END IF;
    IF utilization_row.party_credit_source_id IS NULL OR utilization_row.party_credit_source_id = utilization_row.id THEN
        RAISE EXCEPTION 'Credit utilization must reference a distinct credit-generation allocation';
    END IF;

    SELECT * INTO source_row FROM payment_allocations WHERE id = utilization_row.party_credit_source_id FOR UPDATE;
    IF NOT FOUND OR source_row.allocation_type <> 'CREDIT_GENERATED' OR source_row.allocation_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Credit utilization requires an active CREDIT_GENERATED source allocation';
    END IF;
    SELECT * INTO source_payment FROM payments WHERE id = source_row.payment_id;
    IF NOT FOUND OR source_payment.payment_status <> 'ACTIVE'
       OR source_payment.payment_type <> 'INCOMING'
       OR source_payment.category NOT IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT') THEN
        RAISE EXCEPTION 'Credit utilization requires an active incoming party source payment';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM party_credits pc
        WHERE pc.credit_allocation_id = source_row.id
          AND pc.payment_id = source_row.payment_id
          AND pc.party_id = source_payment.party_id
    ) THEN
        RAISE EXCEPTION 'Credit source has no matching party-credit identity';
    END IF;

    IF utilization_row.bill_id IS NOT NULL THEN
        SELECT party_id INTO target_party_id FROM bills
         WHERE id = utilization_row.bill_id AND bill_status <> 'CANCELLED';
    ELSE
        SELECT party_id INTO target_party_id FROM trips
         WHERE id = utilization_row.trip_id AND status <> 'CANCELLED';
    END IF;
    IF target_party_id IS NULL OR target_party_id <> source_payment.party_id THEN
        RAISE EXCEPTION 'Credit source and bill/trip target must belong to the same party';
    END IF;

    IF utilization_row.payment_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM payments context_payment
        WHERE context_payment.id = utilization_row.payment_id
          AND context_payment.payment_status = 'ACTIVE'
          AND context_payment.payment_type = 'INCOMING'
          AND context_payment.category IN ('COMPANY_PAYMENT', 'MARKET_PARTY_PAYMENT')
          AND context_payment.party_id = target_party_id
    ) THEN
        RAISE EXCEPTION 'Optional payment context must be an active incoming payment for the target party';
    END IF;

    SELECT COALESCE(SUM(used.allocation_amount), 0) INTO used_total
      FROM payment_allocations used
     WHERE used.party_credit_source_id = source_row.id
       AND used.allocation_type = 'CREDIT_UTILIZED'
       AND used.allocation_status = 'ACTIVE'
       AND (used.payment_id IS NULL OR EXISTS (
           SELECT 1 FROM payments context_payment
           WHERE context_payment.id = used.payment_id AND context_payment.payment_status = 'ACTIVE'
       ));
    IF used_total > source_row.allocation_amount THEN
        RAISE EXCEPTION 'Party credit utilization exceeds the source credit amount';
    END IF;
END;
$$;

CREATE FUNCTION deferred_validate_credit_utilization() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN PERFORM validate_credit_utilization(OLD.id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM validate_credit_utilization(NEW.id); END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION reverse_credit_utilizations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.allocation_type = 'CREDIT_GENERATED' AND OLD.allocation_status = 'ACTIVE'
       AND NEW.allocation_status = 'REVERSED' THEN
        UPDATE payment_allocations
           SET allocation_status = 'REVERSED', reversed_at = NEW.reversed_at, updated_at = now()
         WHERE party_credit_source_id = NEW.id
           AND allocation_type = 'CREDIT_UTILIZED'
           AND allocation_status = 'ACTIVE';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION guard_active_credit_target_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'bills'
       AND NEW.party_id IS DISTINCT FROM OLD.party_id
       AND EXISTS (SELECT 1 FROM payment_allocations WHERE bill_id = OLD.id AND allocation_type = 'CREDIT_UTILIZED' AND allocation_status = 'ACTIVE') THEN
        RAISE EXCEPTION 'A bill with active credit utilization cannot change parties';
    END IF;
    IF TG_TABLE_NAME = 'trips'
       AND (NEW.party_id IS DISTINCT FROM OLD.party_id OR (NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED'))
       AND EXISTS (SELECT 1 FROM payment_allocations WHERE trip_id = OLD.id AND allocation_type = 'CREDIT_UTILIZED' AND allocation_status = 'ACTIVE') THEN
        RAISE EXCEPTION 'A trip with active credit utilization cannot change parties or be cancelled';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION deferred_validate_payment_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'payments' THEN
        PERFORM validate_payment_integrity(COALESCE(NEW.id, OLD.id));
    ELSE
        IF TG_OP <> 'INSERT' THEN PERFORM validate_payment_integrity(OLD.payment_id); END IF;
        IF TG_OP <> 'DELETE' THEN PERFORM validate_payment_integrity(NEW.payment_id); END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION validate_bill_allocations() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    bill_key UUID;
    bill_sum NUMERIC(18,2);
    allocation_sum NUMERIC(18,2);
    version_line_sum NUMERIC(18,2);
    active_version_id UUID;
    current_line_count BIGINT;
    version_line_count BIGINT;
BEGIN
    IF TG_TABLE_NAME = 'bills' THEN
        bill_key := COALESCE(NEW.id, OLD.id);
    ELSIF TG_TABLE_NAME IN ('bill_items', 'payment_allocations', 'bill_versions') THEN
        bill_key := COALESCE(NEW.bill_id, OLD.bill_id);
    ELSE
        SELECT bill_id INTO bill_key FROM bill_versions
         WHERE id = COALESCE(NEW.bill_version_id, OLD.bill_version_id);
    END IF;
    IF bill_key IS NULL THEN RETURN NULL; END IF;
    SELECT COALESCE(SUM(line_amount), 0) INTO bill_sum FROM bill_items WHERE bill_id = bill_key AND is_active;
    IF EXISTS (SELECT 1 FROM bills WHERE id = bill_key AND bill_status <> 'CANCELLED') THEN
        SELECT id INTO active_version_id FROM bill_versions WHERE bill_id = bill_key AND version_status = 'ACTIVE';
        IF active_version_id IS NULL THEN RAISE EXCEPTION 'A non-cancelled bill must have exactly one active version'; END IF;
        SELECT COALESCE(SUM(line_amount), 0) INTO version_line_sum FROM bill_version_items WHERE bill_version_id = active_version_id;
        SELECT COUNT(*) INTO current_line_count FROM bill_items WHERE bill_id = bill_key AND is_active;
        SELECT COUNT(*) INTO version_line_count FROM bill_version_items WHERE bill_version_id = active_version_id;
        IF version_line_sum <> bill_sum OR current_line_count <> version_line_count OR EXISTS (
            SELECT 1 FROM bill_items bi
            LEFT JOIN bill_version_items vi ON vi.bill_version_id = active_version_id AND vi.sequence_no = bi.sequence_no
            WHERE bi.bill_id = bill_key AND bi.is_active AND (
                vi.id IS NULL OR ROW(bi.trip_id, bi.sequence_no, bi.description, bi.quantity, bi.unit_price, bi.line_amount)
                IS DISTINCT FROM ROW(vi.trip_id, vi.sequence_no, vi.description, vi.quantity, vi.unit_price, vi.line_amount)
            )
        ) THEN RAISE EXCEPTION 'Current bill lines must match the active bill-version line snapshot'; END IF;
    END IF;
        SELECT COALESCE(SUM(pa.allocation_amount), 0) INTO allocation_sum
            FROM payment_allocations pa
         WHERE pa.bill_id = bill_key AND pa.allocation_status = 'ACTIVE'
             AND (
                     (pa.allocation_type = 'BILL' AND EXISTS (SELECT 1 FROM payments p WHERE p.id = pa.payment_id AND p.payment_status = 'ACTIVE'))
                     OR (pa.allocation_type = 'CREDIT_UTILIZED' AND EXISTS (
                             SELECT 1 FROM payment_allocations source
                             JOIN payments source_payment ON source_payment.id = source.payment_id
                             WHERE source.id = pa.party_credit_source_id AND source.allocation_type = 'CREDIT_GENERATED'
                                 AND source.allocation_status = 'ACTIVE' AND source_payment.payment_status = 'ACTIVE'
                     ))
             );
    IF allocation_sum > bill_sum THEN RAISE EXCEPTION 'Active bill allocations cannot exceed bill total'; END IF;
    IF EXISTS (SELECT 1 FROM bills WHERE id = bill_key AND bill_status = 'CANCELLED') AND allocation_sum <> 0 THEN
        RAISE EXCEPTION 'Cancelled bills cannot retain active payment allocations';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION validate_expense_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    expense_id UUID;
    expense_amount NUMERIC(18,2);
    allocated_amount NUMERIC(18,2);
BEGIN
    IF TG_TABLE_NAME = 'own_fleet_expense_details' THEN
        expense_id := COALESCE(NEW.id, OLD.id);
    ELSE
        expense_id := COALESCE(NEW.own_fleet_expense_detail_id, OLD.own_fleet_expense_detail_id);
    END IF;
    IF expense_id IS NULL THEN RETURN NULL; END IF;
    SELECT amount INTO expense_amount FROM own_fleet_expense_details WHERE id = expense_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM own_fleet_expense_details e JOIN trips t ON t.id = e.trip_id
                   WHERE e.id = expense_id AND t.vehicle_relationship = 'OWN_FLEET') THEN
        RAISE EXCEPTION 'Own-fleet expense details must reference an own-fleet trip';
    END IF;
    SELECT COALESCE(SUM(pa.allocation_amount), 0) INTO allocated_amount FROM payment_allocations pa
      JOIN payments p ON p.id = pa.payment_id AND p.payment_status = 'ACTIVE'
     WHERE pa.own_fleet_expense_detail_id = expense_id AND pa.allocation_type = 'OWN_FLEET_EXPENSE' AND pa.allocation_status = 'ACTIVE';
    IF allocated_amount NOT IN (0, expense_amount) THEN
        RAISE EXCEPTION 'A linked own-fleet expense must be settled for its exact contextual amount';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION validate_credit_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id
                   WHERE pa.id = NEW.credit_allocation_id AND pa.allocation_type = 'CREDIT_GENERATED'
                     AND pa.payment_id = NEW.payment_id AND p.party_id = NEW.party_id) THEN
        RAISE EXCEPTION 'Party credit must reference its incoming payment credit-generation allocation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION reject_core_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% records are retained; use the documented reversal, cancellation, or soft-delete workflow', TG_TABLE_NAME;
END;
$$;

CREATE FUNCTION guard_payment_reversal_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.payment_status = 'REVERSED' THEN
        RAISE EXCEPTION 'Reversed payments are immutable and cannot be restored';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION guard_allocation_reversal_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.allocation_status = 'REVERSED' THEN
        RAISE EXCEPTION 'Reversed payment allocations are immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION validate_fifo_mapping() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    allocation_row payment_allocations%ROWTYPE;
    source_payment_id UUID;
    run_payment_id UUID;
BEGIN
    SELECT pa.* INTO allocation_row FROM payment_allocations pa WHERE pa.id = NEW.allocation_id;
    SELECT payment_id INTO run_payment_id FROM payment_fifo_runs WHERE id = NEW.fifo_run_id;
    IF allocation_row.allocation_type = 'CREDIT_GENERATED' THEN
        IF allocation_row.payment_id IS DISTINCT FROM run_payment_id THEN
            RAISE EXCEPTION 'FIFO credit generation must reference its source payment';
        END IF;
        IF NEW.target_trip_id IS NOT NULL OR NEW.target_bill_id IS NOT NULL THEN
            RAISE EXCEPTION 'FIFO credit-generation metadata cannot have a trip or bill target';
        END IF;
    ELSIF allocation_row.allocation_type = 'CREDIT_UTILIZED' THEN
        SELECT payment_id INTO source_payment_id FROM payment_allocations WHERE id = allocation_row.party_credit_source_id;
        IF COALESCE(allocation_row.payment_id, source_payment_id) IS DISTINCT FROM run_payment_id THEN
            RAISE EXCEPTION 'FIFO credit utilization must reference its payment context or source payment';
        END IF;
        IF allocation_row.trip_id IS DISTINCT FROM NEW.target_trip_id OR allocation_row.bill_id IS DISTINCT FROM NEW.target_bill_id THEN
            RAISE EXCEPTION 'FIFO target must match its canonical credit-utilization target';
        END IF;
    ELSIF allocation_row.allocation_type NOT IN ('BILL', 'TRIP') THEN
        RAISE EXCEPTION 'FIFO metadata may reference only BILL, TRIP, CREDIT_GENERATED, or CREDIT_UTILIZED allocations';
    ELSIF allocation_row.payment_id IS DISTINCT FROM run_payment_id
       OR allocation_row.trip_id IS DISTINCT FROM NEW.target_trip_id OR allocation_row.bill_id IS DISTINCT FROM NEW.target_bill_id THEN
        RAISE EXCEPTION 'FIFO target must match its canonical allocation target';
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION reject_historical_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '% rows are append-only and cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

CREATE FUNCTION guard_bill_version_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Bill versions are retained permanently'; END IF;
    IF NEW.template_id IS DISTINCT FROM OLD.template_id AND NOT (OLD.template_id IS NOT NULL AND NEW.template_id IS NULL) THEN
        RAISE EXCEPTION 'Bill version template reference may only be cleared when its template is removed';
    END IF;
    IF ROW(NEW.bill_id, NEW.version_number, NEW.version_label, NEW.template_snapshot,
           NEW.header_snapshot, NEW.totals_snapshot, NEW.resolved_dynamic_fields, NEW.document_reference,
           NEW.created_by, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.bill_id, OLD.version_number, OLD.version_label, OLD.template_snapshot,
           OLD.header_snapshot, OLD.totals_snapshot, OLD.resolved_dynamic_fields, OLD.document_reference,
           OLD.created_by, OLD.created_at) THEN
        RAISE EXCEPTION 'Bill version snapshots are immutable; create a new version';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION capture_bill_template_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    template_row bill_templates%ROWTYPE;
BEGIN
    IF NEW.template_id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO template_row FROM bill_templates WHERE id = NEW.template_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Bill template does not exist'; END IF;

    NEW.template_snapshot := jsonb_build_object(
        'template', jsonb_build_object('name', template_row.name, 'template_type', template_row.template_type),
        'layout', template_row.layout_json,
        'components', COALESCE((
            SELECT jsonb_agg(to_jsonb(component) - 'id' - 'template_id' ORDER BY component.component_key)
              FROM bill_template_components component WHERE component.template_id = template_row.id
        ), '[]'::jsonb),
        'assets', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'asset_type', asset.asset_type, 'file_name', asset.file_name,
                'storage_key', asset.storage_key, 'content_checksum', asset.content_checksum,
                'mime_type', asset.mime_type, 'width', asset.width, 'height', asset.height
            ) ORDER BY asset.file_name)
              FROM bill_template_assets asset WHERE asset.template_id = template_row.id
        ), '[]'::jsonb),
        'dynamic_field_definitions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'binding_path', mapping.binding_path, 'display_label', mapping.display_label,
                'is_repeatable', mapping.is_repeatable, 'default_value', mapping.default_value,
                'source_entity', definition.source_entity, 'field_key', definition.field_key,
                'field_label', definition.field_label, 'data_type', definition.data_type
            ) ORDER BY mapping.binding_path)
              FROM bill_template_dynamic_fields mapping
              JOIN dynamic_field_definitions definition ON definition.id = mapping.field_definition_id
             WHERE mapping.template_id = template_row.id
        ), '[]'::jsonb)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trip_financial_cache_guard BEFORE INSERT OR UPDATE ON trip_party_financials
    FOR EACH ROW EXECUTE FUNCTION guard_trip_financial_cache();
CREATE TRIGGER owner_financial_cache_guard BEFORE INSERT OR UPDATE ON trip_vehicle_owner_financials
    FOR EACH ROW EXECUTE FUNCTION guard_trip_financial_cache();
CREATE TRIGGER recalc_trip_party_after_insert_delete AFTER INSERT OR DELETE ON trip_party_financials
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_party_after_amount_update AFTER UPDATE OF freight_amount, detention_amount, tds_amount ON trip_party_financials
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_owner_after_insert_delete AFTER INSERT OR DELETE ON trip_vehicle_owner_financials
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_owner_after_amount_update AFTER UPDATE OF freight_amount, detention_amount ON trip_vehicle_owner_financials
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_other_charges AFTER INSERT OR UPDATE OR DELETE ON trip_other_charges
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_deductions AFTER INSERT OR UPDATE OR DELETE ON trip_deductions
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();
CREATE TRIGGER recalc_trip_unloading AFTER INSERT OR UPDATE OR DELETE ON trip_unloading_charges
    FOR EACH ROW EXECUTE FUNCTION refresh_trip_financial_cache();

CREATE TRIGGER bill_derived_values_guard BEFORE INSERT OR UPDATE ON bills
    FOR EACH ROW EXECUTE FUNCTION guard_bill_derived_values();
CREATE TRIGGER bill_credit_target_party_guard BEFORE UPDATE OF party_id ON bills
    FOR EACH ROW EXECUTE FUNCTION guard_active_credit_target_change();
CREATE TRIGGER trip_credit_target_guard BEFORE UPDATE OF party_id, status ON trips
    FOR EACH ROW EXECUTE FUNCTION guard_active_credit_target_change();
CREATE TRIGGER bill_items_set_active BEFORE INSERT OR UPDATE OF bill_id ON bill_items
    FOR EACH ROW EXECUTE FUNCTION bill_item_set_active();
CREATE TRIGGER bill_items_activity_guard BEFORE UPDATE ON bill_items
    FOR EACH ROW EXECUTE FUNCTION guard_bill_item_change();
CREATE TRIGGER bill_cancel_deactivates_items AFTER UPDATE OF bill_status ON bills
    FOR EACH ROW EXECUTE FUNCTION sync_bill_item_activity();
CREATE TRIGGER recalc_bill_after_items AFTER INSERT OR UPDATE OR DELETE ON bill_items
    FOR EACH ROW EXECUTE FUNCTION refresh_bill_cache_from_source();
CREATE TRIGGER recalc_bill_after_allocations AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
    FOR EACH ROW EXECUTE FUNCTION refresh_bill_cache_from_source();
CREATE TRIGGER recalc_bill_after_payment_change AFTER UPDATE OF payment_status ON payments
    FOR EACH ROW EXECUTE FUNCTION refresh_bill_cache_from_source();
CREATE TRIGGER reverse_allocations_on_payment_reversal AFTER UPDATE OF payment_status ON payments
    FOR EACH ROW EXECUTE FUNCTION reverse_payment_allocations();
CREATE TRIGGER reverse_credit_uses_on_source_reversal AFTER UPDATE OF allocation_status ON payment_allocations
    FOR EACH ROW EXECUTE FUNCTION reverse_credit_utilizations();

CREATE CONSTRAINT TRIGGER payments_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON payments
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION deferred_validate_payment_integrity();
CREATE CONSTRAINT TRIGGER payment_allocations_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION deferred_validate_payment_integrity();
CREATE CONSTRAINT TRIGGER credit_utilization_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION deferred_validate_credit_utilization();
CREATE CONSTRAINT TRIGGER bill_allocations_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_bill_allocations();
CREATE CONSTRAINT TRIGGER bill_lines_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON bill_items
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_bill_allocations();
CREATE CONSTRAINT TRIGGER bills_integrity_deferred AFTER INSERT OR UPDATE ON bills
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_bill_allocations();
CREATE CONSTRAINT TRIGGER bill_versions_integrity_deferred AFTER INSERT OR UPDATE ON bill_versions
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_bill_allocations();
CREATE CONSTRAINT TRIGGER bill_version_items_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON bill_version_items
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_bill_allocations();
CREATE CONSTRAINT TRIGGER own_fleet_expense_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON own_fleet_expense_details
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_expense_payment();
CREATE CONSTRAINT TRIGGER own_fleet_expense_alloc_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_expense_payment();
CREATE CONSTRAINT TRIGGER party_credit_source_integrity_deferred AFTER INSERT OR UPDATE ON party_credits
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_credit_source();
CREATE CONSTRAINT TRIGGER party_credit_payment_integrity_deferred AFTER INSERT OR UPDATE OR DELETE ON party_credits
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION deferred_validate_payment_integrity();
CREATE CONSTRAINT TRIGGER fifo_mapping_integrity_deferred AFTER INSERT OR UPDATE ON payment_fifo_run_allocations
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_fifo_mapping();

CREATE TRIGGER bill_versions_capture_template BEFORE INSERT ON bill_versions
    FOR EACH ROW EXECUTE FUNCTION capture_bill_template_snapshot();
CREATE TRIGGER bill_versions_snapshot_guard BEFORE UPDATE OR DELETE ON bill_versions
    FOR EACH ROW EXECUTE FUNCTION guard_bill_version_snapshot();
CREATE TRIGGER bill_version_items_append_only BEFORE UPDATE OR DELETE ON bill_version_items
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER payment_allocation_history_append_only BEFORE UPDATE OR DELETE ON payment_allocation_history
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER own_fleet_status_history_append_only BEFORE UPDATE OR DELETE ON own_fleet_vehicle_status_history
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER document_links_append_only BEFORE UPDATE OR DELETE ON document_links
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER party_credits_identity_append_only BEFORE UPDATE OR DELETE ON party_credits
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER payment_fifo_runs_append_only BEFORE UPDATE OR DELETE ON payment_fifo_runs
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER payment_fifo_allocations_append_only BEFORE UPDATE OR DELETE ON payment_fifo_run_allocations
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER trip_destinations_no_delete BEFORE DELETE ON trip_destinations
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_party_financials_no_delete BEFORE DELETE ON trip_party_financials
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_owner_financials_no_delete BEFORE DELETE ON trip_vehicle_owner_financials
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_pods_no_delete BEFORE DELETE ON trip_pods
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_issues_no_delete BEFORE DELETE ON trip_issues
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER own_fleet_expense_details_no_delete BEFORE DELETE ON own_fleet_expense_details
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_other_charges_no_delete BEFORE DELETE ON trip_other_charges
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_deductions_no_delete BEFORE DELETE ON trip_deductions
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER trip_unloading_charges_no_delete BEFORE DELETE ON trip_unloading_charges
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER payment_allocations_no_delete BEFORE DELETE ON payment_allocations
    FOR EACH ROW EXECUTE FUNCTION reject_historical_mutation();
CREATE TRIGGER payment_allocations_reversal_guard BEFORE UPDATE ON payment_allocations
    FOR EACH ROW EXECUTE FUNCTION guard_allocation_reversal_history();
CREATE TRIGGER payments_reversal_guard BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION guard_payment_reversal_history();
CREATE TRIGGER trips_no_delete BEFORE DELETE ON trips
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER bills_no_delete BEFORE DELETE ON bills
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER financial_years_no_delete BEFORE DELETE ON financial_years
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER documents_no_delete BEFORE DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER own_fleet_vehicles_no_delete BEFORE DELETE ON own_fleet_vehicles
    FOR EACH ROW EXECUTE FUNCTION reject_core_delete();
CREATE TRIGGER parties_payment_type_guard BEFORE UPDATE OF party_type ON parties
    FOR EACH ROW EXECUTE FUNCTION guard_payment_entity_type_change();
CREATE TRIGGER categories_payment_type_guard BEFORE UPDATE OF category_type ON other_business_categories
    FOR EACH ROW EXECUTE FUNCTION guard_payment_entity_type_change();

CREATE INDEX IF NOT EXISTS idx_users_role_is_active ON users (role, is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_financial_years_is_active ON financial_years (is_active);
CREATE INDEX IF NOT EXISTS idx_dynamic_field_definitions_active ON dynamic_field_definitions (is_active);
CREATE INDEX IF NOT EXISTS idx_bill_templates_status ON bill_templates (status);
CREATE INDEX IF NOT EXISTS idx_parties_name ON parties (name);
CREATE INDEX IF NOT EXISTS idx_parties_mobile ON parties (primary_mobile);
CREATE INDEX IF NOT EXISTS idx_parties_party_type ON parties (party_type);
CREATE INDEX IF NOT EXISTS idx_party_billing_configs_template_id ON party_billing_configs (default_template_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_owners_name ON vehicle_owners (name);
CREATE INDEX IF NOT EXISTS idx_vehicle_owners_mobile ON vehicle_owners (mobile_number);
CREATE INDEX IF NOT EXISTS idx_market_vehicles_owner_id ON market_vehicles (vehicle_owner_id);
CREATE INDEX IF NOT EXISTS idx_own_fleet_vehicles_manual_state ON own_fleet_vehicles (manual_state);
CREATE INDEX IF NOT EXISTS idx_own_fleet_status_vehicle_id_time ON own_fleet_vehicle_status_history (own_fleet_vehicle_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_trips_party_id ON trips (party_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips (status);
CREATE INDEX IF NOT EXISTS idx_trips_trip_date ON trips (trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_owner_id ON trips (vehicle_owner_id);
CREATE INDEX IF NOT EXISTS idx_trips_market_vehicle_id ON trips (market_vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_own_fleet_vehicle_id ON trips (own_fleet_vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_lr_number_unique ON trips (lr_number) WHERE lr_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_invoice_number_unique ON trips (invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trip_other_charges_trip_id ON trip_other_charges (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_other_charges_side ON trip_other_charges (side);
CREATE INDEX IF NOT EXISTS idx_trip_deductions_trip_id ON trip_deductions (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_deductions_side ON trip_deductions (side);
CREATE INDEX IF NOT EXISTS idx_trip_unloading_charges_trip_id ON trip_unloading_charges (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_unloading_charges_side ON trip_unloading_charges (side);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_pods_docket_number_unique ON trip_pods (docket_number) WHERE docket_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trip_issues_trip_id ON trip_issues (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_issues_status ON trip_issues (status);
CREATE INDEX IF NOT EXISTS idx_other_business_categories_active ON other_business_categories (is_active);
CREATE INDEX IF NOT EXISTS idx_other_business_categories_type ON other_business_categories (category_type);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments (payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_party_id ON payments (party_id);
CREATE INDEX IF NOT EXISTS idx_payments_vehicle_owner_id ON payments (vehicle_owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments (payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_category ON payments (category);
CREATE INDEX IF NOT EXISTS idx_own_fleet_expense_details_trip_id ON own_fleet_expense_details (trip_id);
CREATE INDEX IF NOT EXISTS idx_own_fleet_expense_details_category ON own_fleet_expense_details (expense_category);
CREATE INDEX IF NOT EXISTS idx_bills_party_id ON bills (party_id);
CREATE INDEX IF NOT EXISTS idx_bills_financial_year_id ON bills (financial_year_id);
CREATE INDEX IF NOT EXISTS idx_bills_bill_status ON bills (bill_status);
CREATE INDEX IF NOT EXISTS idx_bill_items_trip_id ON bill_items (trip_id);
CREATE INDEX IF NOT EXISTS idx_bill_versions_template_id ON bill_versions (template_id);
CREATE INDEX IF NOT EXISTS idx_bill_versions_status ON bill_versions (version_status);
CREATE INDEX IF NOT EXISTS idx_bill_version_items_trip_id ON bill_version_items (trip_id);
CREATE INDEX IF NOT EXISTS idx_bill_numbering_series_fy_id ON bill_numbering_series (financial_year_id);
CREATE INDEX IF NOT EXISTS idx_bill_numbering_series_active ON bill_numbering_series (is_active);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_trip_id ON payment_allocations (trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_bill_id ON payment_allocations (bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_status ON payment_allocations (allocation_status);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_type ON payment_allocations (allocation_type);
CREATE INDEX IF NOT EXISTS idx_payment_allocation_history_allocation_id ON payment_allocation_history (allocation_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocation_history_event_at ON payment_allocation_history (event_at);
CREATE INDEX IF NOT EXISTS idx_payment_fifo_runs_status ON payment_fifo_runs (run_status);
CREATE INDEX IF NOT EXISTS idx_payment_fifo_run_allocations_target_trip_id ON payment_fifo_run_allocations (target_trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_fifo_run_allocations_target_bill_id ON payment_fifo_run_allocations (target_bill_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_expense_detail_id ON payment_allocations (own_fleet_expense_detail_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_allocations_active_expense_unique ON payment_allocations (own_fleet_expense_detail_id)
    WHERE own_fleet_expense_detail_id IS NOT NULL AND allocation_type = 'OWN_FLEET_EXPENSE' AND allocation_status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_party_credits_party_id ON party_credits (party_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents (document_type);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_storage_key ON documents (storage_key);
CREATE INDEX IF NOT EXISTS idx_document_links_entity ON document_links (entity_type);
CREATE INDEX IF NOT EXISTS idx_document_links_entity_id ON document_links (entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_items_active_trip_unique ON bill_items (trip_id) WHERE trip_id IS NOT NULL AND is_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_versions_one_active_per_bill ON bill_versions (bill_id) WHERE version_status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_user_id ON audit_events (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_time ON audit_events (event_time);

COMMIT;
