-- =============================================================================
-- GSF NAV DW2 PostgreSQL Schema
-- =============================================================================
-- Author: Bakhrom Botirov
-- Date: 12/08/2025
-- 
-- Database: ait_db
-- Schema: dw2_nav
-- Source: Microsoft Dynamics NAV Data Warehouse (DW2.nav)
-- 
-- Conversion Notes:
-- - All nvarchar/varchar columns converted to TEXT (PostgreSQL optimizes internally)
-- - datetime/datetime2 converted to TIMESTAMPTZ (GSF operates in multiple timezones)
-- - tinyint converted to BOOLEAN for flags, SMALLINT for enums/counters
-- - decimal without precision (PostgreSQL handles arbitrary precision)
-- - varchar(32) preserved for NAV DateFormula fields (Lead Time Calculation, etc.)
-- - Table names: snake_case (no prefix, schema provides namespace)
-- - Column names: snake_case (preserving NAV abbreviations like no_, qty_, purch_)
-- - No FK constraints (DW pattern for ETL performance) - relationships documented
-- - Indexes on all FK columns for query optimization
-- =============================================================================

-- Create schema
CREATE SCHEMA IF NOT EXISTS dw2_nav;

-- Set search path
SET search_path TO dw2_nav, public;


-- =============================================================================
-- Table: acc_schedule_line
-- Original NAV Table: Acc_ Schedule Line
-- Columns: 24
-- =============================================================================

CREATE TABLE dw2_nav.acc_schedule_line (
    source_db text NOT NULL,
    hash text,
    schedule_name text NOT NULL,
    line_no_ integer NOT NULL,
    row_no_ text,
    description text,
    totaling text,
    totaling_type integer,
    new_page boolean,
    indentation integer,
    show integer,
    dimension_1_totaling text,
    dimension_2_totaling text,
    dimension_3_totaling text,
    dimension_4_totaling text,
    bold boolean,
    italic boolean,
    underline boolean,
    show_opposite_sign boolean,
    row_type integer,
    amount_type integer,
    double_underline boolean,
    cost_center_totaling text,
    cost_object_totaling text,
    CONSTRAINT acc_schedule_line_pkey PRIMARY KEY (source_db, schedule_name, line_no_)
);

COMMENT ON TABLE dw2_nav.acc_schedule_line IS 'NAV Table: Acc_ Schedule Line';

-- =============================================================================
-- Table: accounting_period
-- Original NAV Table: Accounting Period
-- Columns: 9
-- =============================================================================

CREATE TABLE dw2_nav.accounting_period (
    source_db text NOT NULL,
    hash text,
    starting_date timestamptz NOT NULL,
    name text,
    new_fiscal_year boolean,
    closed boolean,
    date_locked boolean,
    average_cost_calc_type integer,
    average_cost_period integer,
    CONSTRAINT accounting_period_pkey PRIMARY KEY (source_db, starting_date)
);

COMMENT ON TABLE dw2_nav.accounting_period IS 'NAV Table: Accounting Period';

-- =============================================================================
-- Table: appointment_schedule
-- Original NAV Table: Appointment Schedule
-- Columns: 9
-- =============================================================================

CREATE TABLE dw2_nav.appointment_schedule (
    source_db text NOT NULL,
    hash text,
    location_code text NOT NULL,
    code text NOT NULL,
    date timestamptz NOT NULL,
    time timestamptz NOT NULL,
    document_no_ text,
    vendor_name text,
    user_id text,
    CONSTRAINT appointment_schedule_pkey PRIMARY KEY (source_db, location_code, code, date, time)
);

COMMENT ON TABLE dw2_nav.appointment_schedule IS 'NAV Table: Appointment Schedule';

-- =============================================================================
-- Table: bank_account
-- Original NAV Table: Bank Account
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.bank_account (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    name text,
    search_name text,
    name_2 text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    bank_acc_posting_group text,
    last_check_no_ text,
    CONSTRAINT bank_account_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.bank_account IS 'NAV Table: Bank Account';

-- =============================================================================
-- Table: bid_header
-- Original NAV Table: Bid Header
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.bid_header (
    source_db text NOT NULL,
    hash text,
    code text NOT NULL,
    description text,
    standard_markup integer,
    bid_type integer,
    markup_cost integer,
    fixed_price boolean,
    starting_date timestamptz,
    ending_date timestamptz,
    CONSTRAINT bid_header_pkey PRIMARY KEY (source_db, code)
);

COMMENT ON TABLE dw2_nav.bid_header IS 'NAV Table: Bid Header';

-- =============================================================================
-- Table: bid_line
-- Original NAV Table: Bid Line
-- Columns: 25
-- =============================================================================

CREATE TABLE dw2_nav.bid_line (
    source_db text NOT NULL,
    hash text,
    code text NOT NULL,
    item_type integer NOT NULL,
    item_code text NOT NULL,
    starting_date timestamptz NOT NULL,
    ending_date timestamptz NOT NULL,
    standard_markup integer,
    bid_type integer,
    markup_cost integer,
    fixed_price boolean,
    markup_amount decimal,
    current_price decimal,
    future_price decimal,
    actual_cost decimal,
    allowance_per_case decimal,
    break_case_upcharge decimal,
    current_break_case_price decimal,
    future_break_case_price decimal,
    change_code text,
    cost_type integer,
    sales_rep_cost_overide decimal,
    locked boolean,
    commodity_markup_amount decimal,
    commodity_break_case_upcharge decimal,
    CONSTRAINT bid_line_pkey PRIMARY KEY (source_db, code, item_type, item_code, starting_date, ending_date)
);

COMMENT ON TABLE dw2_nav.bid_line IS 'NAV Table: Bid Line';

-- =============================================================================
-- Table: bin
-- Original NAV Table: Bin
-- Columns: 36
-- =============================================================================

CREATE TABLE dw2_nav.bin (
    source_db text NOT NULL,
    hash text,
    location_code text NOT NULL,
    code text NOT NULL,
    description text,
    zone_code text,
    bin_type_code text,
    warehouse_class_code text,
    block_movement integer,
    special_equipment_code text,
    bin_ranking integer,
    maximum_cubage decimal,
    maximum_weight decimal,
    empty boolean,
    cross_dock_bin smallint,
    dedicated boolean,
    aisle integer,
    side integer,
    position integer,
    level integer,
    distance integer,
    bin_size decimal,
    bin_height decimal,
    dummy_bin smallint,
    wave_pick_bin boolean,
    bin_sorting integer,
    pallet_bin smallint,
    pallet_counting_period text,
    last_counted_date timestamptz,
    pallet_count_ranking integer,
    included_in_quick_count boolean,
    drop_bin smallint,
    linked_to_drop_bin text,
    last_counted_datetime timestamptz,
    default_replenishment_rule text,
    pallet_type text,
    CONSTRAINT bin_pkey PRIMARY KEY (source_db, location_code, code)
);

COMMENT ON TABLE dw2_nav.bin IS 'NAV Table: Bin';

-- =============================================================================
-- Table: bin_content
-- Original NAV Table: Bin Content
-- Columns: 24
-- =============================================================================

CREATE TABLE dw2_nav.bin_content (
    source_db text NOT NULL,
    hash text,
    location_code text NOT NULL,
    bin_code text NOT NULL,
    item_no_ text NOT NULL,
    variant_code text NOT NULL,
    unit_of_measure_code text NOT NULL,
    zone_code text,
    bin_type_code text,
    warehouse_class_code text,
    block_movement integer,
    min_qty decimal,
    max_qty decimal,
    bin_ranking integer,
    fixed boolean,
    cross_dock_bin smallint,
    default boolean,
    qty_per_unit_of_measure decimal,
    dedicated boolean,
    replen_user text,
    source_no_ text,
    bin_sorting integer,
    license_plate_ranking integer,
    replenishment_rule text,
    CONSTRAINT bin_content_pkey PRIMARY KEY (source_db, location_code, bin_code, item_no_, variant_code, unit_of_measure_code)
);

COMMENT ON TABLE dw2_nav.bin_content IS 'NAV Table: Bin Content';

-- =============================================================================
-- Table: bin_type
-- Original NAV Table: Bin Type
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.bin_type (
    source_db text NOT NULL,
    hash text,
    code text NOT NULL,
    description text,
    receive boolean,
    ship boolean,
    put_away boolean,
    pick boolean,
    pallet_pick boolean,
    special_order smallint,
    CONSTRAINT bin_type_pkey PRIMARY KEY (source_db, code)
);

COMMENT ON TABLE dw2_nav.bin_type IS 'NAV Table: Bin Type';

-- =============================================================================
-- Table: campaign
-- Original NAV Table: Campaign
-- Columns: 14
-- =============================================================================

CREATE TABLE dw2_nav.campaign (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    description text,
    starting_date timestamptz,
    ending_date timestamptz,
    salesperson_code text,
    last_date_modified timestamptz,
    no_series text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    status_code text,
    price_sequence integer,
    location_code text,
    CONSTRAINT campaign_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.campaign IS 'NAV Table: Campaign';

-- =============================================================================
-- Table: campaign_target_group
-- Original NAV Table: Campaign Target Group
-- Columns: 6
-- =============================================================================

CREATE TABLE dw2_nav.campaign_target_group (
    source_db text NOT NULL,
    hash text,
    type integer NOT NULL,
    no_ text NOT NULL,
    campaign_no_ text NOT NULL,
    price_sequence integer,
    CONSTRAINT campaign_target_group_pkey PRIMARY KEY (source_db, type, no_, campaign_no_)
);

COMMENT ON TABLE dw2_nav.campaign_target_group IS 'NAV Table: Campaign Target Group';

-- =============================================================================
-- Table: change_log_entry
-- Original NAV Table: Change Log Entry
-- Columns: 16
-- =============================================================================

CREATE TABLE dw2_nav.change_log_entry (
    source_db text NOT NULL,
    entry_no_ bigint NOT NULL,
    date_and_time timestamptz,
    time timestamptz,
    user_id text,
    table_no_ integer,
    field_no_ integer,
    type_of_change integer,
    old_value text,
    new_value text,
    primary_key_field_1_no_ integer,
    primary_key_field_1_value text,
    primary_key_field_2_no_ integer,
    primary_key_field_2_value text,
    primary_key_field_3_no_ integer,
    primary_key_field_3_value text,
    CONSTRAINT change_log_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.change_log_entry IS 'NAV Table: Change Log Entry';

-- =============================================================================
-- Table: change_log_entry_full_history
-- Original NAV Table: Change Log Entry (Full History)
-- Columns: 16
-- =============================================================================

CREATE TABLE dw2_nav.change_log_entry_full_history (
    source_db text NOT NULL,
    entry_no_ bigint NOT NULL,
    date_and_time timestamptz,
    time timestamptz,
    user_id text,
    table_no_ integer,
    field_no_ integer,
    type_of_change integer,
    old_value text,
    new_value text,
    primary_key_field_1_no_ integer,
    primary_key_field_1_value text,
    primary_key_field_2_no_ integer,
    primary_key_field_2_value text,
    primary_key_field_3_no_ integer,
    primary_key_field_3_value text,
    CONSTRAINT change_log_entry_full_history_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.change_log_entry_full_history IS 'NAV Table: Change Log Entry (Full History)';

-- =============================================================================
-- Table: co_op_distributor_transaction
-- Original NAV Table: Co-op Distributor Transaction
-- Columns: 27
-- =============================================================================

CREATE TABLE dw2_nav.co_op_distributor_transaction (
    source_db text NOT NULL,
    hash text,
    manufacturer_code text NOT NULL,
    recipient_agency_no_ text NOT NULL,
    document_no_ text NOT NULL,
    document_line_no_ text NOT NULL,
    manufacture_item_no_ text NOT NULL,
    document_type text NOT NULL,
    reported_by text,
    document_date timestamptz,
    quantity decimal,
    distributor_name text,
    bill_to_customer_no_ text,
    nav_vendor_no_ text,
    nav_item_no_ text,
    line_import_error boolean,
    error_message text,
    date_imported timestamptz,
    time_imported timestamptz,
    imported_by text,
    date_processed timestamptz,
    time_processed timestamptz,
    posted_by text,
    import_filename text,
    distributor_name_modified text,
    commodity_ledger_entry_no_ integer,
    entry_no_ integer,
    CONSTRAINT co_op_distributor_transaction_pkey PRIMARY KEY (source_db, manufacturer_code, recipient_agency_no_, document_no_, document_line_no_, manufacture_item_no_, document_type)
);

COMMENT ON TABLE dw2_nav.co_op_distributor_transaction IS 'NAV Table: Co-op Distributor Transaction';

-- =============================================================================
-- Table: commodity_amt_limit
-- Original NAV Table: Commodity AMT Limit
-- Columns: 3
-- =============================================================================

CREATE TABLE dw2_nav.commodity_amt_limit (
    source_db text NOT NULL,
    hash text,
    co_op_district_amt_code text NOT NULL,
    CONSTRAINT commodity_amt_limit_pkey PRIMARY KEY (source_db, co_op_district_amt_code)
);

COMMENT ON TABLE dw2_nav.commodity_amt_limit IS 'NAV Table: Commodity AMT Limit';

-- =============================================================================
-- Table: commodity_component
-- Original NAV Table: Commodity Component
-- Columns: 9
-- =============================================================================

CREATE TABLE dw2_nav.commodity_component (
    source_db text NOT NULL,
    hash text,
    parent_item_no_ text NOT NULL,
    vendor_no_ text NOT NULL,
    line_no_ integer NOT NULL,
    item_no_ text,
    unit_of_measure_code text NOT NULL,
    yield decimal,
    net_off_invoice_amount decimal,
    CONSTRAINT commodity_component_pkey PRIMARY KEY (source_db, parent_item_no_, vendor_no_, line_no_, unit_of_measure_code)
);

COMMENT ON TABLE dw2_nav.commodity_component IS 'NAV Table: Commodity Component';

-- =============================================================================
-- Table: commodity_lb_limit
-- Original NAV Table: Commodity LB Limit
-- Columns: 5
-- =============================================================================

CREATE TABLE dw2_nav.commodity_lb_limit (
    source_db text NOT NULL,
    hash text,
    co_op_district_quantity_code text NOT NULL,
    vendor_group_code text NOT NULL,
    item_no_ text NOT NULL,
    CONSTRAINT commodity_lb_limit_pkey PRIMARY KEY (source_db, co_op_district_quantity_code, vendor_group_code, item_no_)
);

COMMENT ON TABLE dw2_nav.commodity_lb_limit IS 'NAV Table: Commodity LB Limit';

-- =============================================================================
-- Table: commodity_ledger_entry
-- Original NAV Table: Commodity Ledger Entry
-- Columns: 29
-- =============================================================================

CREATE TABLE dw2_nav.commodity_ledger_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    item_no_ text,
    posting_date timestamptz,
    entry_type integer,
    document_no_ text,
    vendor_group_code text,
    document_type integer,
    document_line_no_ integer,
    item_ledger_entry_no_ integer,
    true_posting_date_time timestamptz,
    quantity decimal,
    bill_to_customer_no_ text,
    distributor_name text,
    distributor_sub_name text,
    co_op_district_quantity_code text,
    amount decimal,
    fair_market_value decimal,
    unit_of_measure_code text,
    reason_code text,
    gsf_item boolean,
    finished_good boolean,
    reported_by text,
    co_op_district_amount_code text,
    entitlement_type text,
    outside_sale boolean,
    state_code text,
    commodity_region text,
    CONSTRAINT commodity_ledger_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.commodity_ledger_entry IS 'NAV Table: Commodity Ledger Entry';

-- =============================================================================
-- Table: commodity_opt_out
-- Original NAV Table: Commodity Opt Out
-- Columns: 6
-- =============================================================================

CREATE TABLE dw2_nav.commodity_opt_out (
    source_db text NOT NULL,
    hash text,
    co_op_district_group_code text NOT NULL,
    vendor_group_code text NOT NULL,
    item_no_ text NOT NULL,
    type integer,
    CONSTRAINT commodity_opt_out_pkey PRIMARY KEY (source_db, co_op_district_group_code, vendor_group_code, item_no_)
);

COMMENT ON TABLE dw2_nav.commodity_opt_out IS 'NAV Table: Commodity Opt Out';

-- =============================================================================
-- Table: contact
-- Original NAV Table: Contact
-- Columns: 30
-- =============================================================================

CREATE TABLE dw2_nav.contact (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    name text,
    search_name text,
    name_2 text,
    address text,
    address_2 text,
    city text,
    phone_no_ text,
    salesperson_code text,
    fax_no_ text,
    post_code text,
    county text,
    e_mail text,
    home_page text,
    no_series text,
    type integer,
    company_no_ text,
    company_name text,
    first_name text,
    middle_name text,
    surname text,
    job_title text,
    mobile_phone_no_ text,
    pager text,
    organizational_level_code text,
    exclude_from_segment boolean,
    search_e_mail text,
    e_mail_2 text,
    CONSTRAINT contact_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.contact IS 'NAV Table: Contact';

-- =============================================================================
-- Table: contact_business_relation
-- Original NAV Table: Contact Business Relation
-- Columns: 6
-- =============================================================================

CREATE TABLE dw2_nav.contact_business_relation (
    source_db text NOT NULL,
    hash text,
    contact_no_ text NOT NULL,
    business_relation_code text NOT NULL,
    link_to_table integer,
    no_ text,
    CONSTRAINT contact_business_relation_pkey PRIMARY KEY (source_db, contact_no_, business_relation_code)
);

COMMENT ON TABLE dw2_nav.contact_business_relation IS 'NAV Table: Contact Business Relation';

-- =============================================================================
-- Table: cust_ledger_entry
-- Original NAV Table: Cust_ Ledger Entry
-- Columns: 44
-- =============================================================================

CREATE TABLE dw2_nav.cust_ledger_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    customer_no_ text,
    posting_date timestamptz,
    document_type integer,
    document_no_ text,
    description text,
    sales_lcy decimal,
    profit_lcy decimal,
    inv_discount_lcy decimal,
    sell_to_customer_no_ text,
    customer_posting_group text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    salesperson_code text,
    user_id text,
    source_code text,
    open boolean,
    due_date timestamptz,
    pmt_discount_date timestamptz,
    original_pmt_disc_possible decimal,
    pmt_disc_given_lcy decimal,
    positive boolean,
    closed_by_entry_no_ integer,
    closed_at_date timestamptz,
    closed_by_amount decimal,
    applies_to_id text,
    journal_batch_name text,
    reason_code text,
    bal_account_type integer,
    bal_account_no_ text,
    transaction_no_ integer,
    closed_by_amount_lcy decimal,
    document_date timestamptz,
    external_document_no_ text,
    no_series text,
    closed_by_currency_amount decimal,
    adjusted_currency_factor decimal,
    original_currency_factor decimal,
    remaining_pmt_disc_possible decimal,
    pmt_disc_tolerance_date timestamptz,
    dimension_set_id integer,
    order_type text,
    CONSTRAINT cust_ledger_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.cust_ledger_entry IS 'NAV Table: Cust_ Ledger Entry';

-- =============================================================================
-- Table: customer
-- Original NAV Table: Customer
-- Columns: 82
-- =============================================================================

CREATE TABLE dw2_nav.customer (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    name text,
    name_2 text,
    address text,
    address_2 text,
    city text,
    contact text,
    phone_no_ text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    customer_posting_group text,
    payment_terms_code text,
    salesperson_code text,
    shipment_method_code text,
    invoice_disc_code text,
    customer_disc_group text,
    country_region_code text,
    print_statements boolean,
    bill_to_customer_no_ text,
    payment_method_code text,
    location_code text,
    combine_shipments boolean,
    gen_bus_posting_group text,
    post_code text,
    county text,
    e_mail text,
    tax_area_code text,
    tax_liable boolean,
    reserve integer,
    primary_contact_no_ text,
    allow_line_disc boolean,
    tax_area_id uuid,
    csr text,
    district_group_code text,
    price_orders_at_shipment boolean,
    geographic_code text,
    sodexo_unit_no_ text,
    ra_no_ text,
    hours_of_operation text,
    bill_to_primary_contact_no_ text,
    default_external_document_no_ text,
    dod_usda_customer_no_ text,
    allow_zero_qty_lines boolean,
    combine_bread_broadline boolean,
    online_customer boolean,
    pricing_uses_order_date smallint,
    charge_storage_fees smallint,
    rebate_invoices boolean,
    ups_location_code text,
    exclude_from_crv boolean,
    use_invoice_with_zones boolean,
    special_instructions text,
    bill_to_customer smallint,
    customer_accepts_subs smallint,
    keys_to_gate smallint,
    keys_to_kitchen smallint,
    keys_to_walk_in smallint,
    co_op_code text,
    5_star_exception smallint,
    do_not_combine boolean,
    do_not_break_item smallint,
    tls integer,
    order_type text,
    njpa_code integer,
    customer_drop_type text,
    pallet_per_item smallint,
    audit_picks boolean,
    edi_invoice integer,
    edi_trade_partner text,
    dod_customer boolean,
    chain_name text,
    priority integer,
    legacy_no_ text,
    sync_filter text,
    credit_limit_lcy decimal,
    type text,
    group text,
    status text,
    account_type text,
    commodity_region text,
    CONSTRAINT customer_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.customer IS 'NAV Table: Customer';

-- =============================================================================
-- Table: customer_grouping
-- Original NAV Table: Customer Grouping
-- Columns: 8
-- =============================================================================

CREATE TABLE dw2_nav.customer_grouping (
    source_db text NOT NULL,
    hash text,
    type text NOT NULL,
    code text NOT NULL,
    customer_type integer NOT NULL,
    customer_code text NOT NULL,
    priority integer,
    exclude boolean,
    CONSTRAINT customer_grouping_pkey PRIMARY KEY (source_db, type, code, customer_type, customer_code)
);

COMMENT ON TABLE dw2_nav.customer_grouping IS 'NAV Table: Customer Grouping';

-- =============================================================================
-- Table: default_dimension
-- Original NAV Table: Default Dimension
-- Columns: 8
-- =============================================================================

CREATE TABLE dw2_nav.default_dimension (
    source_db text NOT NULL,
    hash text,
    table_id integer NOT NULL,
    no_ text NOT NULL,
    dimension_code text NOT NULL,
    dimension_value_code text,
    value_posting integer,
    multi_selection_action integer,
    CONSTRAINT default_dimension_pkey PRIMARY KEY (source_db, table_id, no_, dimension_code)
);

COMMENT ON TABLE dw2_nav.default_dimension IS 'NAV Table: Default Dimension';

-- =============================================================================
-- Table: delivery_schedule
-- Original NAV Table: Delivery Schedule
-- Columns: 21
-- =============================================================================

CREATE TABLE dw2_nav.delivery_schedule (
    source_db text NOT NULL,
    hash text,
    type integer NOT NULL,
    source_no_ text NOT NULL,
    order_type text NOT NULL,
    monday boolean,
    tuesday boolean,
    wednesday boolean,
    thursday boolean,
    friday boolean,
    saturday boolean,
    sunday boolean,
    minimum_order_amount decimal,
    lead_time integer,
    back_date_in_days integer,
    csr text,
    first_week boolean,
    second_week boolean,
    third_week boolean,
    fourth_week boolean,
    last_week boolean,
    CONSTRAINT delivery_schedule_pkey PRIMARY KEY (source_db, type, source_no_, order_type)
);

COMMENT ON TABLE dw2_nav.delivery_schedule IS 'NAV Table: Delivery Schedule';

-- =============================================================================
-- Table: detailed_cust_ledg_entry
-- Original NAV Table: Detailed Cust_ Ledg_ Entry
-- Columns: 32
-- =============================================================================

CREATE TABLE dw2_nav.detailed_cust_ledg_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    cust_ledger_entry_no_ integer,
    entry_type integer,
    posting_date timestamptz,
    document_type integer,
    document_no_ text,
    amount decimal,
    amount_lcy decimal,
    customer_no_ text,
    user_id text,
    source_code text,
    transaction_no_ integer,
    journal_batch_name text,
    reason_code text,
    debit_amount decimal,
    credit_amount decimal,
    debit_amount_lcy decimal,
    credit_amount_lcy decimal,
    initial_entry_due_date timestamptz,
    initial_entry_global_dim_1 text,
    initial_entry_global_dim_2 text,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    initial_document_type integer,
    applied_cust_ledger_entry_no_ integer,
    unapplied boolean,
    unapplied_by_entry_no_ integer,
    remaining_pmt_disc_possible decimal,
    max_payment_tolerance decimal,
    ledger_entry_amount boolean,
    CONSTRAINT detailed_cust_ledg_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.detailed_cust_ledg_entry IS 'NAV Table: Detailed Cust_ Ledg_ Entry';

-- =============================================================================
-- Table: detailed_vendor_ledg_entry
-- Original NAV Table: Detailed Vendor Ledg_ Entry
-- Columns: 34
-- =============================================================================

CREATE TABLE dw2_nav.detailed_vendor_ledg_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    vendor_ledger_entry_no_ integer,
    entry_type integer,
    posting_date timestamptz,
    document_type integer,
    document_no_ text,
    amount decimal,
    amount_lcy decimal,
    vendor_no_ text,
    user_id text,
    source_code text,
    transaction_no_ integer,
    journal_batch_name text,
    reason_code text,
    debit_amount decimal,
    credit_amount decimal,
    debit_amount_lcy decimal,
    credit_amount_lcy decimal,
    initial_entry_due_date timestamptz,
    initial_entry_global_dim_1 text,
    initial_entry_global_dim_2 text,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    initial_document_type integer,
    applied_vend_ledger_entry_no_ integer,
    unapplied boolean,
    unapplied_by_entry_no_ integer,
    remaining_pmt_disc_possible decimal,
    max_payment_tolerance decimal,
    tax_jurisdiction_code text,
    application_no_ integer,
    ledger_entry_amount boolean,
    CONSTRAINT detailed_vendor_ledg_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.detailed_vendor_ledg_entry IS 'NAV Table: Detailed Vendor Ledg_ Entry';

-- =============================================================================
-- Table: dimension_set_entry
-- Original NAV Table: Dimension Set Entry
-- Columns: 6
-- =============================================================================

CREATE TABLE dw2_nav.dimension_set_entry (
    source_db text NOT NULL,
    hash text,
    dimension_set_id integer NOT NULL,
    dimension_code text NOT NULL,
    dimension_value_code text,
    dimension_value_id integer,
    CONSTRAINT dimension_set_entry_pkey PRIMARY KEY (source_db, dimension_set_id, dimension_code)
);

COMMENT ON TABLE dw2_nav.dimension_set_entry IS 'NAV Table: Dimension Set Entry';

-- =============================================================================
-- Table: dimension_value
-- Original NAV Table: Dimension Value
-- Columns: 12
-- =============================================================================

CREATE TABLE dw2_nav.dimension_value (
    source_db text NOT NULL,
    hash text,
    dimension_code text NOT NULL,
    code text NOT NULL,
    name text,
    dimension_value_type integer,
    totaling text,
    blocked boolean,
    consolidation_code text,
    indentation integer,
    global_dimension_no_ integer,
    dimension_value_id integer,
    CONSTRAINT dimension_value_pkey PRIMARY KEY (source_db, dimension_code, code)
);

COMMENT ON TABLE dw2_nav.dimension_value IS 'NAV Table: Dimension Value';

-- =============================================================================
-- Table: employee
-- Original NAV Table: Employee
-- Columns: 12
-- =============================================================================

CREATE TABLE dw2_nav.employee (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    first_name text,
    middle_name text,
    last_name text,
    initials text,
    job_title text,
    e_mail text,
    manager_no_ text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    CONSTRAINT employee_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.employee IS 'NAV Table: Employee';

-- =============================================================================
-- Table: fixed_asset
-- Original NAV Table: Fixed Asset
-- Columns: 21
-- =============================================================================

CREATE TABLE dw2_nav.fixed_asset (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    description text,
    search_description text,
    description_2 text,
    fa_class_code text,
    fa_subclass_code text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    location_code text,
    fa_location_code text,
    vendor_no_ text,
    responsible_employee text,
    serial_no_ text,
    blocked boolean,
    maintenance_vendor_no_ text,
    under_maintenance smallint,
    inactive boolean,
    no_series text,
    fa_posting_group text,
    CONSTRAINT fixed_asset_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.fixed_asset IS 'NAV Table: Fixed Asset';

-- =============================================================================
-- Table: gsf_item_cost
-- Original NAV Table: GSF Item Cost
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.gsf_item_cost (
    source_db text NOT NULL,
    hash text,
    location_code text NOT NULL,
    item_no_ text NOT NULL,
    code text NOT NULL,
    amount decimal,
    amount_type integer,
    calculated_amount decimal,
    validfrom timestamptz,
    validto timestamptz,
    CONSTRAINT gsf_item_cost_pkey PRIMARY KEY (source_db, location_code, item_no_, code)
);

COMMENT ON TABLE dw2_nav.gsf_item_cost IS 'NAV Table: GSF Item Cost';

-- =============================================================================
-- Table: gsf_item_cost_history
-- Original NAV Table: GSF Item Cost History
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.gsf_item_cost_history (
    source_db text,
    hash text,
    location_code text,
    item_no_ text,
    code text,
    amount decimal,
    amount_type integer,
    calculated_amount decimal,
    validfrom timestamptz,
    validto timestamptz
);

COMMENT ON TABLE dw2_nav.gsf_item_cost_history IS 'NAV Table: GSF Item Cost History';

-- =============================================================================
-- Table: gsf_item_usage
-- Original NAV Table: GSF Item Usage
-- Columns: 19
-- =============================================================================

CREATE TABLE dw2_nav.gsf_item_usage (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    location_code text,
    item_no_ text,
    entry_type integer,
    posting_date timestamptz,
    month integer,
    week integer,
    year integer,
    document_no_ text,
    document_type integer,
    source_no_ text,
    source_type integer,
    quantity decimal,
    qty_per_unit_of_measure decimal,
    unit_of_measure_code text,
    redirected_from_item_no_ text,
    bill_to_customer_no_ text,
    CONSTRAINT gsf_item_usage_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.gsf_item_usage IS 'NAV Table: GSF Item Usage';

-- =============================================================================
-- Table: gsf_sales_price
-- Original NAV Table: GSF Sales Price
-- Columns: 11
-- =============================================================================

CREATE TABLE dw2_nav.gsf_sales_price (
    source_db text NOT NULL,
    hash text,
    bill_to_customer_no_ text NOT NULL,
    item_no_ text NOT NULL,
    unit_of_measure_code text NOT NULL,
    unit_price decimal,
    contract_item boolean,
    bid_code text,
    last_date_updated timestamptz,
    starting_date timestamptz,
    ending_date timestamptz,
    CONSTRAINT gsf_sales_price_pkey PRIMARY KEY (source_db, bill_to_customer_no_, item_no_, unit_of_measure_code)
);

COMMENT ON TABLE dw2_nav.gsf_sales_price IS 'NAV Table: GSF Sales Price';

-- =============================================================================
-- Table: g_l_account
-- Original NAV Table: G_L Account
-- Columns: 22
-- =============================================================================

CREATE TABLE dw2_nav.g_l_account (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    name text,
    search_name text,
    account_type integer,
    global_dimension_1_code text,
    global_dimension_2_code text,
    account_category integer,
    income_balance integer,
    debit_credit integer,
    no_2 text,
    blocked boolean,
    direct_posting smallint,
    reconciliation_account smallint,
    gen_posting_type integer,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    tax_area_code text,
    tax_liable boolean,
    tax_group_code text,
    id uuid,
    CONSTRAINT g_l_account_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.g_l_account IS 'NAV Table: G_L Account';

-- =============================================================================
-- Table: g_l_entry
-- Original NAV Table: G_L Entry
-- Columns: 28
-- =============================================================================

CREATE TABLE dw2_nav.g_l_entry (
    source_db text NOT NULL,
    entry_no_ integer NOT NULL,
    g_l_account_no_ text,
    posting_date timestamptz,
    document_type integer,
    document_no_ text,
    description text,
    bal_account_no_ text,
    amount decimal,
    global_dimension_1_code text,
    global_dimension_2_code text,
    user_id text,
    source_code text,
    quantity decimal,
    journal_batch_name text,
    reason_code text,
    gen_posting_type integer,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    transaction_no_ integer,
    debit_amount decimal,
    credit_amount decimal,
    document_date timestamptz,
    source_type integer,
    source_no_ text,
    no_series text,
    dimension_set_id integer,
    external_document_no_ text,
    CONSTRAINT g_l_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.g_l_entry IS 'NAV Table: G_L Entry';

-- =============================================================================
-- Table: item
-- Original NAV Table: Item
-- Columns: 108
-- =============================================================================

CREATE TABLE dw2_nav.item (
    validfrom timestamptz,
    validto timestamptz,
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    no_2 text,
    description text,
    description_2 text,
    base_unit_of_measure text,
    price_unit_conversion integer,
    type integer,
    inventory_posting_group text,
    item_disc_group text,
    allow_invoice_disc boolean,
    unit_price decimal,
    price_profit_calculation integer,
    profit decimal,
    costing_method integer,
    unit_cost decimal,
    last_direct_cost decimal,
    cost_is_adjusted boolean,
    allow_online_adjustment boolean,
    vendor_no_ text,
    vendor_item_no_ text,
    lead_time_calculation varchar(32),
    reorder_point decimal,
    maximum_inventory decimal,
    reorder_quantity decimal,
    alternative_item_no_ text,
    unit_list_price decimal,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    country_region_purchased_code text,
    blocked boolean,
    block_reason text,
    gen_prod_posting_group text,
    country_region_of_origin_code text,
    reserve integer,
    global_dimension_1_code text,
    global_dimension_2_code text,
    lot_size decimal,
    last_unit_cost_calc_date timestamptz,
    minimum_order_quantity decimal,
    safety_stock_quantity decimal,
    order_multiple decimal,
    safety_lead_time varchar(32),
    sales_unit_of_measure text,
    purch_unit_of_measure text,
    reordering_policy integer,
    include_inventory boolean,
    manufacturer_code text,
    item_category_code text,
    product_group_code text,
    phys_invt_counting_period_code text,
    last_counting_period_update timestamptz,
    use_cross_docking boolean,
    next_counting_start_date timestamptz,
    next_counting_end_date timestamptz,
    expiration_date_type integer,
    expiration_date_rule integer,
    buyer_code text,
    crv decimal,
    shelf_life_in_days integer,
    shelf_life text,
    specials_list smallint,
    sodexo_only smallint,
    pack_size text,
    item_class text,
    active_since timestamptz,
    current_vendor_no_ text,
    commodity_dependency integer,
    commodity_fee_basis integer,
    fair_market_value decimal,
    cmdy_value_exception smallint,
    df_lb_per_case decimal,
    commodity_additional_allowance decimal,
    onelink_order_guide integer,
    market_price_item boolean,
    zero_price_allowed boolean,
    zone text,
    repack_item_no_ text,
    repack_qty decimal,
    lb_item_no_ text,
    master_item_no_ text,
    master_item boolean,
    njpa boolean,
    always_create_pick boolean,
    status text,
    rebate_vendor_no_ text,
    catch_weight boolean,
    use_unit_of_measure_dimensions boolean,
    producer_of_good_indicator integer,
    item_upc_ean_number text,
    routing_no_ text,
    production_bom_no_ text,
    order_tracking_policy integer,
    critical boolean,
    suggested_weeks_on_hand decimal,
    city_state_zip_code_of_origin text,
    category_class_code text,
    gtin text,
    mfg_name text,
    non_domestic boolean,
    food_item boolean,
    last_direct_lb_cost decimal,
    exception_type text,
    CONSTRAINT item_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.item IS 'NAV Table: Item';

-- =============================================================================
-- Table: item_application_entry
-- Original NAV Table: Item Application Entry
-- Columns: 16
-- =============================================================================

CREATE TABLE dw2_nav.item_application_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    item_ledger_entry_no_ integer,
    inbound_item_entry_no_ integer,
    outbound_item_entry_no_ integer,
    quantity decimal,
    posting_date timestamptz,
    transferred_from_entry_no_ integer,
    creation_date timestamptz,
    created_by_user text,
    last_modified_date timestamptz,
    last_modified_by_user text,
    cost_application smallint,
    output_completely_invd_date timestamptz,
    outbound_entry_is_updated boolean,
    CONSTRAINT item_application_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.item_application_entry IS 'NAV Table: Item Application Entry';

-- =============================================================================
-- Table: item_charge
-- Original NAV Table: Item Charge
-- Columns: 10
-- =============================================================================

CREATE TABLE dw2_nav.item_charge (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    description text,
    gen_prod_posting_group text,
    tax_group_code text,
    vat_prod_posting_group text,
    search_description text,
    global_dimension_1_code text,
    global_dimension_2_code text,
    CONSTRAINT item_charge_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.item_charge IS 'NAV Table: Item Charge';

-- =============================================================================
-- Table: item_date_range
-- Original NAV Table: Item Date Range
-- Columns: 9
-- =============================================================================

CREATE TABLE dw2_nav.item_date_range (
    source_db text NOT NULL,
    hash text,
    item_no_ text NOT NULL,
    code text NOT NULL,
    starting_date timestamptz NOT NULL,
    ending_date timestamptz,
    quantity decimal,
    amount decimal,
    text text,
    CONSTRAINT item_date_range_pkey PRIMARY KEY (source_db, item_no_, code, starting_date)
);

COMMENT ON TABLE dw2_nav.item_date_range IS 'NAV Table: Item Date Range';

-- =============================================================================
-- Table: item_grouping
-- Original NAV Table: Item Grouping
-- Columns: 7
-- =============================================================================

CREATE TABLE dw2_nav.item_grouping (
    source_db text NOT NULL,
    hash text,
    type text NOT NULL,
    code text NOT NULL,
    item_type integer NOT NULL,
    item_code text NOT NULL,
    exclude boolean,
    CONSTRAINT item_grouping_pkey PRIMARY KEY (source_db, type, code, item_type, item_code)
);

COMMENT ON TABLE dw2_nav.item_grouping IS 'NAV Table: Item Grouping';

-- =============================================================================
-- Table: item_history
-- Original NAV Table: Item History
-- Columns: 108
-- =============================================================================

CREATE TABLE dw2_nav.item_history (
    validfrom timestamptz,
    validto timestamptz,
    source_db text,
    hash text,
    no_ text,
    no_2 text,
    description text,
    description_2 text,
    base_unit_of_measure text,
    price_unit_conversion integer,
    type integer,
    inventory_posting_group text,
    item_disc_group text,
    allow_invoice_disc boolean,
    unit_price decimal,
    price_profit_calculation integer,
    profit decimal,
    costing_method integer,
    unit_cost decimal,
    last_direct_cost decimal,
    cost_is_adjusted boolean,
    allow_online_adjustment boolean,
    vendor_no_ text,
    vendor_item_no_ text,
    lead_time_calculation varchar(32),
    reorder_point decimal,
    maximum_inventory decimal,
    reorder_quantity decimal,
    alternative_item_no_ text,
    unit_list_price decimal,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    country_region_purchased_code text,
    blocked boolean,
    block_reason text,
    gen_prod_posting_group text,
    country_region_of_origin_code text,
    reserve integer,
    global_dimension_1_code text,
    global_dimension_2_code text,
    lot_size decimal,
    last_unit_cost_calc_date timestamptz,
    minimum_order_quantity decimal,
    safety_stock_quantity decimal,
    order_multiple decimal,
    safety_lead_time varchar(32),
    sales_unit_of_measure text,
    purch_unit_of_measure text,
    reordering_policy integer,
    include_inventory boolean,
    manufacturer_code text,
    item_category_code text,
    product_group_code text,
    phys_invt_counting_period_code text,
    last_counting_period_update timestamptz,
    use_cross_docking boolean,
    next_counting_start_date timestamptz,
    next_counting_end_date timestamptz,
    expiration_date_type integer,
    expiration_date_rule integer,
    buyer_code text,
    crv decimal,
    shelf_life_in_days integer,
    shelf_life text,
    specials_list smallint,
    sodexo_only smallint,
    pack_size text,
    item_class text,
    active_since timestamptz,
    current_vendor_no_ text,
    commodity_dependency integer,
    commodity_fee_basis integer,
    fair_market_value decimal,
    cmdy_value_exception smallint,
    df_lb_per_case decimal,
    commodity_additional_allowance decimal,
    onelink_order_guide integer,
    market_price_item boolean,
    zero_price_allowed boolean,
    zone text,
    repack_item_no_ text,
    repack_qty decimal,
    lb_item_no_ text,
    master_item_no_ text,
    master_item boolean,
    njpa boolean,
    always_create_pick boolean,
    status text,
    rebate_vendor_no_ text,
    catch_weight boolean,
    use_unit_of_measure_dimensions boolean,
    producer_of_good_indicator integer,
    item_upc_ean_number text,
    routing_no_ text,
    production_bom_no_ text,
    order_tracking_policy integer,
    critical boolean,
    suggested_weeks_on_hand decimal,
    city_state_zip_code_of_origin text,
    category_class_code text,
    gtin text,
    mfg_name text,
    non_domestic boolean,
    food_item boolean,
    last_direct_lb_cost decimal,
    exception_type text
);

COMMENT ON TABLE dw2_nav.item_history IS 'NAV Table: Item History';

-- =============================================================================
-- Table: item_ledger_entry
-- Original NAV Table: Item Ledger Entry
-- Columns: 47
-- =============================================================================

CREATE TABLE dw2_nav.item_ledger_entry (
    source_db text NOT NULL,
    hash text,
    entry_no_ integer NOT NULL,
    item_no_ text,
    posting_date timestamptz,
    entry_type integer,
    source_no_ text,
    document_no_ text,
    description text,
    location_code text,
    quantity decimal,
    remaining_quantity decimal,
    invoiced_quantity decimal,
    applies_to_entry integer,
    open boolean,
    global_dimension_1_code text,
    global_dimension_2_code text,
    positive boolean,
    source_type integer,
    drop_shipment boolean,
    country_region_code text,
    document_date timestamptz,
    external_document_no_ text,
    no_series text,
    document_type integer,
    document_line_no_ integer,
    order_type integer,
    order_no_ text,
    order_line_no_ integer,
    dimension_set_id integer,
    assemble_to_order boolean,
    variant_code text,
    qty_per_unit_of_measure decimal,
    unit_of_measure_code text,
    item_category_code text,
    product_group_code text,
    completely_invoiced boolean,
    last_invoice_date timestamptz,
    correction boolean,
    shipped_qty_not_returned decimal,
    lot_no_ text,
    expiration_date timestamptz,
    item_tracking integer,
    return_reason_code text,
    bill_to_customer_no_ text,
    reason_code text,
    true_posting_date_time timestamptz,
    CONSTRAINT item_ledger_entry_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.item_ledger_entry IS 'NAV Table: Item Ledger Entry';

-- =============================================================================
-- Table: item_old
-- Original NAV Table: Item OLD
-- Columns: 103
-- =============================================================================

CREATE TABLE dw2_nav.item_old (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    no_2 text,
    description text,
    description_2 text,
    base_unit_of_measure text,
    price_unit_conversion integer,
    type integer,
    inventory_posting_group text,
    item_disc_group text,
    allow_invoice_disc boolean,
    unit_price decimal,
    price_profit_calculation integer,
    profit decimal,
    costing_method integer,
    unit_cost decimal,
    last_direct_cost decimal,
    cost_is_adjusted boolean,
    allow_online_adjustment boolean,
    vendor_no_ text,
    vendor_item_no_ text,
    lead_time_calculation varchar(32),
    reorder_point decimal,
    maximum_inventory decimal,
    reorder_quantity decimal,
    alternative_item_no_ text,
    unit_list_price decimal,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    country_region_purchased_code text,
    blocked boolean,
    block_reason text,
    gen_prod_posting_group text,
    country_region_of_origin_code text,
    reserve integer,
    global_dimension_1_code text,
    global_dimension_2_code text,
    lot_size decimal,
    last_unit_cost_calc_date timestamptz,
    minimum_order_quantity decimal,
    safety_stock_quantity decimal,
    order_multiple decimal,
    safety_lead_time varchar(32),
    sales_unit_of_measure text,
    purch_unit_of_measure text,
    reordering_policy integer,
    include_inventory boolean,
    manufacturer_code text,
    item_category_code text,
    product_group_code text,
    phys_invt_counting_period_code text,
    last_counting_period_update timestamptz,
    use_cross_docking boolean,
    next_counting_start_date timestamptz,
    next_counting_end_date timestamptz,
    expiration_date_type integer,
    expiration_date_rule integer,
    buyer_code text,
    crv decimal,
    shelf_life_in_days integer,
    shelf_life text,
    specials_list smallint,
    sodexo_only smallint,
    pack_size text,
    item_class text,
    active_since timestamptz,
    current_vendor_no_ text,
    commodity_dependency integer,
    commodity_fee_basis integer,
    fair_market_value decimal,
    cmdy_value_exception smallint,
    df_lb_per_case decimal,
    commodity_additional_allowance decimal,
    onelink_order_guide integer,
    market_price_item boolean,
    zero_price_allowed boolean,
    zone text,
    repack_item_no_ text,
    repack_qty decimal,
    lb_item_no_ text,
    master_item_no_ text,
    master_item boolean,
    njpa boolean,
    always_create_pick boolean,
    status text,
    rebate_vendor_no_ text,
    catch_weight boolean,
    use_unit_of_measure_dimensions boolean,
    producer_of_good_indicator integer,
    item_upc_ean_number text,
    routing_no_ text,
    production_bom_no_ text,
    order_tracking_policy integer,
    critical boolean,
    suggested_weeks_on_hand decimal,
    city_state_zip_code_of_origin text,
    category_class_code text,
    gtin text,
    mfg_name text,
    non_domestic boolean,
    CONSTRAINT item_old_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.item_old IS 'NAV Table: Item OLD';

-- =============================================================================
-- Table: item_spec
-- Original NAV Table: Item Spec
-- Columns: 66
-- =============================================================================

CREATE TABLE dw2_nav.item_spec (
    source_db text NOT NULL,
    hash text,
    item_no_ text NOT NULL,
    jan boolean,
    feb boolean,
    mar boolean,
    apr boolean,
    may boolean,
    jun boolean,
    jul boolean,
    aug boolean,
    sep boolean,
    oct boolean,
    nov boolean,
    dec boolean,
    sb12 smallint,
    sb965 smallint,
    sb80 smallint,
    smart_snack boolean,
    hhka_non_compliant smallint,
    alliance_healthgen smallint,
    california_fresh_meal_program smallint,
    egg smallint,
    soy smallint,
    milk smallint,
    wheat smallint,
    whey smallint,
    peanut smallint,
    kosher boolean,
    51_whole_grain smallint,
    highfructosecornsfree smallint,
    reduced_sodium smallint,
    gluten_free smallint,
    organic boolean,
    biodegradable smallint,
    vegetarian boolean,
    contains_peanut smallint,
    recycled_materials smallint,
    contains_lftp_pink_slime smallint,
    cn_contributions_breads decimal,
    cn_contributions_meat decimal,
    cn_contributions_fruit decimal,
    cn_contributions_vegetable decimal,
    cn_contributions text,
    component_risk integer,
    repack_item_no_ text,
    repack_qty decimal,
    lb_item_no_ text,
    master_item_no_ text,
    master_item boolean,
    servings_per_case text,
    peanut_free_facility smallint,
    cn_labeled smallint,
    vegan boolean,
    serving_size text,
    units_per_serving text,
    pack_quantity text,
    hardy_produce smallint,
    processed_produce smallint,
    local_food_for_schools_program smallint,
    brominated_vegetable_oil smallint,
    potassium_bromates smallint,
    propylparaben smallint,
    red_dye_3 smallint,
    sf_best_practices_program smallint,
    sca_program smallint,
    CONSTRAINT item_spec_pkey PRIMARY KEY (source_db, item_no_)
);

COMMENT ON TABLE dw2_nav.item_spec IS 'NAV Table: Item Spec';

-- =============================================================================
-- Table: item_unit_of_measure
-- Original NAV Table: Item Unit of Measure
-- Columns: 13
-- =============================================================================

CREATE TABLE dw2_nav.item_unit_of_measure (
    source_db text NOT NULL,
    hash text,
    item_no_ text NOT NULL,
    code text NOT NULL,
    qty_per_unit_of_measure decimal,
    length decimal,
    width decimal,
    height decimal,
    cubage decimal,
    weight decimal,
    std_pack_upc_ean_number text,
    max_adjust_qty decimal,
    sync_filter text,
    CONSTRAINT item_unit_of_measure_pkey PRIMARY KEY (source_db, item_no_, code)
);

COMMENT ON TABLE dw2_nav.item_unit_of_measure IS 'NAV Table: Item Unit of Measure';

-- =============================================================================
-- Table: location
-- Original NAV Table: Location
-- Columns: 127
-- =============================================================================

CREATE TABLE dw2_nav.location (
    source_db text NOT NULL,
    hash text,
    code text NOT NULL,
    name text,
    default_bin_code text,
    name_2 text,
    address text,
    address_2 text,
    city text,
    post_code text,
    county text,
    use_as_in_transit boolean,
    require_put_away boolean,
    require_pick boolean,
    cross_dock_due_date_calc varchar(32),
    use_cross_docking boolean,
    require_receive boolean,
    require_shipment boolean,
    bin_mandatory smallint,
    directed_put_away_and_pick boolean,
    default_bin_selection integer,
    outbound_whse_handling_time varchar(32),
    inbound_whse_handling_time varchar(32),
    put_away_template_code text,
    use_put_away_worksheet boolean,
    pick_according_to_fefo boolean,
    allow_breakbulk boolean,
    bin_capacity_policy integer,
    open_shop_floor_bin_code text,
    to_production_bin_code text,
    from_production_bin_code text,
    adjustment_bin_code text,
    always_create_put_away_line boolean,
    always_create_pick_line boolean,
    receipt_bin_code text,
    shipment_bin_code text,
    cross_dock_bin_code text,
    license_plate_lot_tracking smallint,
    pick_from_total_available_qty boolean,
    use_gsf_epiration_for_replen boolean,
    purchase_label_code text,
    argent_output_folder text,
    print_pallet_counter integer,
    pallet_label_code text,
    general_pk text,
    bulk_pick decimal,
    position_cost integer,
    aisle_side_cost integer,
    height_cost integer,
    change_aisle_cost integer,
    no_of_aisles_to_search integer,
    xml_export_path text,
    update_pick_logic integer,
    route_closing_action integer,
    asc_order_lock_enabled boolean,
    pallet_replenishment smallint,
    ignore_min_qty_in_replenish smallint,
    print_auto_put_away boolean,
    xml_printers integer,
    last_xml_printer_number integer,
    route_label_stylesheet text,
    batch_label_stylesheet text,
    batch_summary_label_stylesheet text,
    aisle_warning_label_stylesheet text,
    bulk_pick_label_stylesheet text,
    bulk_pick_return_stylesheet text,
    item_label_stylesheet text,
    catch_weight_label_stylesheet text,
    pallet_label_stylesheet text,
    unique_label_nos text,
    pallet_layer_height decimal,
    wait_period_rec_worksh_mins integer,
    aisle_code_length integer,
    pass_counter integer,
    no_fixed_bin_setup_code text,
    receive_label_format text,
    receive_label_jobname text,
    receive_label_printnumber integer,
    receive_label_quantity integer,
    po_label_format text,
    po_label_jobname text,
    po_label_printnumber integer,
    po_label_quantity integer,
    allow_empty_at_split_pallet boolean,
    repack_item_jnl_template text,
    repack_item_jnl_batch text,
    show_replen_worksheet boolean,
    show_preview_for_bread_report boolean,
    show_nav_receipt_posting_error boolean,
    do_not_print_purchase_labels boolean,
    do_not_print_pick_labels boolean,
    put_away_test_mode boolean,
    whse_rcpt_per_pallet smallint,
    use_assumed_receipt boolean,
    replenishment_source_bin_type text,
    bread_bin text,
    qa_hold_code text,
    no_pick_bin_code_picking text,
    create_dummy_pick_bin_setup boolean,
    delete_emplty_batch_labels smallint,
    default_dimension text,
    max_bin_nearby_check integer,
    physical_inventory_manager text,
    max_labels_for_item integer,
    pick_from_reserve integer,
    invoice_printer text,
    use_locking boolean,
    registering_user text,
    invoicing_user text,
    picking_user text,
    po_close_email text,
    allow_negative_bin_inventory boolean,
    print_metric_data boolean,
    bulk_label_qty integer,
    show_label_metric_data boolean,
    residential_delivery boolean,
    shipping_payment_type integer,
    initial_lp_qa_status text,
    create_lp_pallets_at_receive boolean,
    use_license_plating boolean,
    pallet_adjustment_bin text,
    require_pallet_qa_record smallint,
    use_fifo_pick_takes_lp boolean,
    use_fifo_replen_takes_lp boolean,
    strict_pallet_bins smallint,
    allow_picking_from_lp boolean,
    enter_catch_weight boolean,
    CONSTRAINT location_pkey PRIMARY KEY (source_db, code)
);

COMMENT ON TABLE dw2_nav.location IS 'NAV Table: Location';

-- =============================================================================
-- Table: lot_no_information
-- Original NAV Table: Lot No_ Information
-- Columns: 14
-- =============================================================================

CREATE TABLE dw2_nav.lot_no_information (
    source_db text NOT NULL,
    hash text,
    item_no_ text NOT NULL,
    variant_code text NOT NULL,
    lot_no_ text NOT NULL,
    description text,
    test_quality integer,
    certificate_number text,
    blocked boolean,
    initial_quantity decimal,
    posting_date timestamptz,
    disposition_no_ text,
    skip_storage_fees smallint,
    storage_begin_date timestamptz,
    CONSTRAINT lot_no_information_pkey PRIMARY KEY (source_db, item_no_, variant_code, lot_no_)
);

COMMENT ON TABLE dw2_nav.lot_no_information IS 'NAV Table: Lot No_ Information';

-- =============================================================================
-- Table: pallet_bin_content
-- Original NAV Table: Pallet Bin Content
-- Columns: 28
-- =============================================================================

CREATE TABLE dw2_nav.pallet_bin_content (
    source_db text NOT NULL,
    hash text,
    bin text NOT NULL,
    location text NOT NULL,
    pallet_no_ text NOT NULL,
    box_no_ text NOT NULL,
    item_no_ text NOT NULL,
    variant_no_ text NOT NULL,
    lot_no_ text NOT NULL,
    serial_no_ text NOT NULL,
    unit_of_measure text NOT NULL,
    description text,
    quantity_base decimal,
    quantity decimal,
    qty_per_uom decimal,
    expiry_date timestamptz,
    warranty_date timestamptz,
    last_handled_date timestamptz,
    last_handled_time timestamptz,
    creation_date timestamptz,
    creation_time timestamptz,
    qa_status text,
    source_type integer,
    source_sub_type integer,
    source_id text,
    source_reference_no_ integer,
    pallet_height decimal,
    counted boolean,
    CONSTRAINT pallet_bin_content_pkey PRIMARY KEY (source_db, bin, location, pallet_no_, box_no_, item_no_, variant_no_, lot_no_, serial_no_, unit_of_measure)
);

COMMENT ON TABLE dw2_nav.pallet_bin_content IS 'NAV Table: Pallet Bin Content';

-- =============================================================================
-- Table: pallet_movement
-- Original NAV Table: Pallet Movement
-- Columns: 24
-- =============================================================================

CREATE TABLE dw2_nav.pallet_movement (
    source_db text NOT NULL,
    hash text,
    entry_no_ bigint NOT NULL,
    from_bin_code text,
    pallet_no_ text,
    line_no_ integer,
    source_no_ text,
    transaction_no_ text,
    location_code text,
    first_scan_date timestamptz,
    first_scan_time timestamptz,
    last_scan_date timestamptz,
    last_scan_time timestamptz,
    warehouse_employee_code text,
    completed boolean,
    door_no_ text,
    to_bin_code text,
    quantity decimal,
    type text,
    full_pallet boolean,
    previous_bin_code text,
    item_no_ text,
    cubage decimal,
    weight decimal,
    CONSTRAINT pallet_movement_pkey PRIMARY KEY (source_db, entry_no_)
);

COMMENT ON TABLE dw2_nav.pallet_movement IS 'NAV Table: Pallet Movement';

-- =============================================================================
-- Table: purch_cr_memo_hdr
-- Original NAV Table: Purch_ Cr_ Memo Hdr_
-- Columns: 68
-- =============================================================================

CREATE TABLE dw2_nav.purch_cr_memo_hdr (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    buy_from_vendor_no_ text,
    pay_to_vendor_no_ text,
    pay_to_name text,
    pay_to_name_2 text,
    pay_to_address text,
    pay_to_address_2 text,
    pay_to_city text,
    pay_to_contact text,
    ship_to_code text,
    ship_to_name text,
    ship_to_name_2 text,
    ship_to_address text,
    ship_to_address_2 text,
    ship_to_city text,
    ship_to_contact text,
    posting_date timestamptz,
    expected_receipt_date timestamptz,
    posting_description text,
    payment_terms_code text,
    due_date timestamptz,
    shipment_method_code text,
    location_code text,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    vendor_posting_group text,
    currency_code text,
    currency_factor decimal,
    prices_including_vat boolean,
    invoice_disc_code text,
    purchaser_code text,
    no_printed integer,
    on_hold text,
    applies_to_doc_type integer,
    applies_to_doc_no_ text,
    bal_account_no_ text,
    vendor_cr_memo_no_ text,
    sell_to_customer_no_ text,
    reason_code text,
    gen_bus_posting_group text,
    transaction_type text,
    transport_method text,
    buy_from_vendor_name text,
    buy_from_vendor_name_2 text,
    buy_from_address text,
    buy_from_address_2 text,
    buy_from_city text,
    buy_from_contact text,
    pay_to_post_code text,
    pay_to_county text,
    pay_to_country_region_code text,
    buy_from_post_code text,
    buy_from_county text,
    buy_from_country_region_code text,
    ship_to_post_code text,
    ship_to_county text,
    ship_to_country_region_code text,
    payment_method_code text,
    source_code text,
    dimension_set_id integer,
    vendor_ledger_entry_no_ integer,
    rebate_type integer,
    rebate_start_date timestamptz,
    rebate_end_date timestamptz,
    rebate_doc_handling integer,
    co_op_code text,
    CONSTRAINT purch_cr_memo_hdr_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.purch_cr_memo_hdr IS 'NAV Table: Purch_ Cr_ Memo Hdr_';

-- =============================================================================
-- Table: purch_cr_memo_line
-- Original NAV Table: Purch_ Cr_ Memo Line
-- Columns: 59
-- =============================================================================

CREATE TABLE dw2_nav.purch_cr_memo_line (
    source_db text NOT NULL,
    hash text,
    document_no_ text NOT NULL,
    line_no_ integer NOT NULL,
    buy_from_vendor_no_ text,
    type integer,
    no_ text,
    location_code text,
    posting_group text,
    expected_receipt_date timestamptz,
    description text,
    description_2 text,
    unit_of_measure text,
    quantity decimal,
    direct_unit_cost decimal,
    unit_cost_lcy decimal,
    vat decimal,
    line_discount decimal,
    line_discount_amount decimal,
    amount decimal,
    amount_including_vat decimal,
    unit_price_lcy decimal,
    allow_invoice_disc boolean,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    appl_to_item_entry integer,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    pay_to_vendor_no_ text,
    inv_discount_amount decimal,
    vendor_item_no_ text,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    transaction_type text,
    tax_area_code text,
    tax_liable boolean,
    tax_group_code text,
    unit_cost decimal,
    line_amount decimal,
    posting_date timestamptz,
    dimension_set_id integer,
    variant_code text,
    bin_code text,
    qty_per_unit_of_measure decimal,
    unit_of_measure_code text,
    quantity_base decimal,
    item_category_code text,
    nonstock boolean,
    purchasing_code text,
    product_group_code text,
    rebate_type integer,
    rebate_source_doc_type integer,
    rebate_source_doc_no_ text,
    rebate_source_doc_line_no_ integer,
    cmdty_value_per_lb decimal,
    pounds decimal,
    cost_per_pound decimal,
    CONSTRAINT purch_cr_memo_line_pkey PRIMARY KEY (source_db, document_no_, line_no_)
);

COMMENT ON TABLE dw2_nav.purch_cr_memo_line IS 'NAV Table: Purch_ Cr_ Memo Line';

-- =============================================================================
-- Table: purch_inv_header
-- Original NAV Table: Purch_ Inv_ Header
-- Columns: 93
-- =============================================================================

CREATE TABLE dw2_nav.purch_inv_header (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    buy_from_vendor_no_ text,
    pay_to_vendor_no_ text,
    pay_to_name text,
    pay_to_address text,
    pay_to_address_2 text,
    pay_to_city text,
    pay_to_contact text,
    your_reference text,
    ship_to_name text,
    ship_to_address text,
    ship_to_address_2 text,
    ship_to_city text,
    ship_to_contact text,
    order_date timestamptz,
    posting_date timestamptz,
    expected_receipt_date timestamptz,
    posting_description text,
    payment_terms_code text,
    due_date timestamptz,
    payment_discount decimal,
    pmt_discount_date timestamptz,
    shipment_method_code text,
    location_code text,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    vendor_posting_group text,
    invoice_disc_code text,
    language_code text,
    purchaser_code text,
    order_no_ text,
    no_printed integer,
    on_hold text,
    applies_to_doc_type integer,
    applies_to_doc_no_ text,
    bal_account_no_ text,
    vendor_order_no_ text,
    vendor_invoice_no_ text,
    vat_registration_no_ text,
    sell_to_customer_no_ text,
    gen_bus_posting_group text,
    vat_country_region_code text,
    buy_from_vendor_name text,
    buy_from_address text,
    buy_from_address_2 text,
    buy_from_city text,
    buy_from_contact text,
    pay_to_post_code text,
    pay_to_county text,
    pay_to_country_region_code text,
    buy_from_post_code text,
    buy_from_county text,
    buy_from_country_region_code text,
    ship_to_post_code text,
    ship_to_county text,
    ship_to_country_region_code text,
    order_address_code text,
    document_date timestamptz,
    payment_method_code text,
    pre_assigned_no_series text,
    no_series text,
    order_no_series text,
    pre_assigned_no_ text,
    user_id text,
    source_code text,
    prepayment_no_series text,
    prepayment_invoice boolean,
    prepayment_order_no_ text,
    dimension_set_id integer,
    vendor_ledger_entry_no_ integer,
    buy_from_contact_no_ text,
    pay_to_contact_no_ text,
    id uuid,
    irs_1099_code text,
    storage_customer text,
    rebate_start_date timestamptz,
    rebate_end_date timestamptz,
    disposition_no_ text,
    offering_no_ text,
    co_op_code text,
    drop_ship_so_no_ text,
    edi_order boolean,
    edi_internal_doc_no_ text,
    edi_po_generated boolean,
    edi_po_gen_date timestamptz,
    edi_ship_adv_gen boolean,
    edi_ship_adv_gen_date timestamptz,
    edi_trade_partner text,
    edi_buy_from_code text,
    e_mail_invoice_notice_handled boolean,
    usda_po_no_ text,
    CONSTRAINT purch_inv_header_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.purch_inv_header IS 'NAV Table: Purch_ Inv_ Header';

-- =============================================================================
-- Table: purch_inv_line
-- Original NAV Table: Purch_ Inv_ Line
-- Columns: 59
-- =============================================================================

CREATE TABLE dw2_nav.purch_inv_line (
    source_db text NOT NULL,
    hash text,
    document_no_ text NOT NULL,
    line_no_ integer NOT NULL,
    buy_from_vendor_no_ text,
    type integer,
    no_ text,
    location_code text,
    posting_group text,
    expected_receipt_date timestamptz,
    description text,
    description_2 text,
    unit_of_measure text,
    quantity decimal,
    direct_unit_cost decimal,
    unit_cost_lcy decimal,
    amount decimal,
    amount_including_vat decimal,
    unit_price_lcy decimal,
    allow_invoice_disc boolean,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    pay_to_vendor_no_ text,
    vendor_item_no_ text,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    vat_calculation_type integer,
    tax_group_code text,
    vat_base_amount decimal,
    unit_cost decimal,
    line_amount decimal,
    ic_partner_code text,
    posting_date timestamptz,
    dimension_set_id integer,
    variant_code text,
    bin_code text,
    qty_per_unit_of_measure decimal,
    unit_of_measure_code text,
    quantity_base decimal,
    item_category_code text,
    product_group_code text,
    irs_1099_liable smallint,
    cmdty_value_per_lb decimal,
    pounds decimal,
    cost_per_pound decimal,
    shipping_charge boolean,
    over_receive boolean,
    over_receive_verified boolean,
    routing_no_ text,
    operation_no_ text,
    work_center_no_ text,
    prod_order_line_no_ integer,
    overhead_rate decimal,
    routing_reference_no_ integer,
    appl_to_order_no_ text,
    CONSTRAINT purch_inv_line_pkey PRIMARY KEY (source_db, document_no_, line_no_)
);

COMMENT ON TABLE dw2_nav.purch_inv_line IS 'NAV Table: Purch_ Inv_ Line';

-- =============================================================================
-- Table: purch_rcpt_header
-- Original NAV Table: Purch_ Rcpt_ Header
-- Columns: 72
-- =============================================================================

CREATE TABLE dw2_nav.purch_rcpt_header (
    source_db text NOT NULL,
    hash text,
    no_ text NOT NULL,
    buy_from_vendor_no_ text,
    pay_to_vendor_no_ text,
    pay_to_name text,
    pay_to_name_2 text,
    pay_to_address text,
    pay_to_address_2 text,
    pay_to_city text,
    pay_to_contact text,
    your_reference text,
    ship_to_code text,
    ship_to_name text,
    ship_to_name_2 text,
    ship_to_address text,
    ship_to_address_2 text,
    ship_to_city text,
    ship_to_contact text,
    order_date timestamptz,
    posting_date timestamptz,
    expected_receipt_date timestamptz,
    posting_description text,
    payment_terms_code text,
    due_date timestamptz,
    payment_discount decimal,
    pmt_discount_date timestamptz,
    shipment_method_code text,
    location_code text,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    vendor_posting_group text,
    invoice_disc_code text,
    purchaser_code text,
    order_no_ text,
    vendor_order_no_ text,
    vendor_shipment_no_ text,
    sell_to_customer_no_ text,
    reason_code text,
    gen_bus_posting_group text,
    vat_country_region_code text,
    buy_from_vendor_name text,
    buy_from_vendor_name_2 text,
    buy_from_address text,
    buy_from_address_2 text,
    buy_from_city text,
    buy_from_contact text,
    pay_to_post_code text,
    pay_to_county text,
    pay_to_country_region_code text,
    buy_from_post_code text,
    buy_from_county text,
    buy_from_country_region_code text,
    ship_to_post_code text,
    ship_to_county text,
    ship_to_country_region_code text,
    correction boolean,
    document_date timestamptz,
    payment_method_code text,
    no_series text,
    order_no_series text,
    user_id text,
    source_code text,
    dimension_set_id integer,
    buy_from_contact_no_ text,
    pay_to_contact_no_ text,
    lead_time_calculation varchar(32),
    disposition_no_ text,
    offering_no_ text,
    co_op_code text,
    freight_vendor text,
    freight_amount decimal,
    CONSTRAINT purch_rcpt_header_pkey PRIMARY KEY (source_db, no_)
);

COMMENT ON TABLE dw2_nav.purch_rcpt_header IS 'NAV Table: Purch_ Rcpt_ Header';

-- =============================================================================
-- Table: purch_rcpt_line
-- Original NAV Table: Purch_ Rcpt_ Line
-- Columns: 74
-- =============================================================================

CREATE TABLE dw2_nav.purch_rcpt_line (
    source_db text NOT NULL,
    hash text,
    document_no_ text NOT NULL,
    line_no_ integer NOT NULL,
    buy_from_vendor_no_ text,
    type integer,
    no_ text,
    location_code text,
    posting_group text,
    expected_receipt_date timestamptz,
    description text,
    description_2 text,
    unit_of_measure text,
    quantity decimal,
    direct_unit_cost decimal,
    unit_cost_lcy decimal,
    line_discount decimal,
    unit_price_lcy decimal,
    allow_invoice_disc boolean,
    gross_weight decimal,
    net_weight decimal,
    units_per_parcel decimal,
    unit_volume decimal,
    appl_to_item_entry integer,
    item_rcpt_entry_no_ integer,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    indirect_cost decimal,
    qty_rcd_not_invoiced decimal,
    quantity_invoiced decimal,
    order_no_ text,
    order_line_no_ integer,
    pay_to_vendor_no_ text,
    vendor_item_no_ text,
    sales_order_no_ text,
    sales_order_line_no_ integer,
    gen_bus_posting_group text,
    gen_prod_posting_group text,
    vat_calculation_type integer,
    unit_cost decimal,
    posting_date timestamptz,
    dimension_set_id integer,
    prod_order_no_ text,
    variant_code text,
    bin_code text,
    qty_per_unit_of_measure decimal,
    unit_of_measure_code text,
    quantity_base decimal,
    qty_invoiced_base decimal,
    item_category_code text,
    nonstock boolean,
    purchasing_code text,
    product_group_code text,
    special_order_sales_no_ text,
    special_order_sales_line_no_ integer,
    requested_receipt_date timestamptz,
    promised_receipt_date timestamptz,
    lead_time_calculation varchar(32),
    inbound_whse_handling_time varchar(32),
    planned_receipt_date timestamptz,
    order_date timestamptz,
    item_charge_base_amount decimal,
    correction boolean,
    return_reason_code text,
    cmdty_value_per_lb decimal,
    pounds decimal,
    cost_per_pound decimal,
    shipping_charge boolean,
    over_receive boolean,
    over_receive_verified boolean,
    routing_no_ text,
    overhead_rate decimal,
    routing_reference_no_ integer,
    city_state_zip_code_of_origin text,
    CONSTRAINT purch_rcpt_line_pkey PRIMARY KEY (source_db, document_no_, line_no_)
);

COMMENT ON TABLE dw2_nav.purch_rcpt_line IS 'NAV Table: Purch_ Rcpt_ Line';

-- =============================================================================
-- Table: purchase_header
-- Original NAV Table: Purchase Header
-- Columns: 147
-- =============================================================================

CREATE TABLE dw2_nav.purchase_header (
    source_db text NOT NULL,
    hash text,
    document_type integer NOT NULL,
    no_ text NOT NULL,
    buy_from_vendor_no_ text,
    pay_to_vendor_no_ text,
    pay_to_name text,
    pay_to_address text,
    pay_to_address_2 text,
    pay_to_city text,
    pay_to_contact text,
    your_reference text,
    ship_to_name text,
    ship_to_address text,
    ship_to_address_2 text,
    ship_to_city text,
    ship_to_contact text,
    order_date timestamptz,
    posting_date timestamptz,
    expected_receipt_date timestamptz,
    posting_description text,
    payment_terms_code text,
    due_date timestamptz,
    payment_discount decimal,
    pmt_discount_date timestamptz,
    shipment_method_code text,
    location_code text,
    shortcut_dimension_1_code text,
    shortcut_dimension_2_code text,
    vendor_posting_group text,
    invoice_disc_code text,
    language_code text,
    purchaser_code text,
    order_class text,
    no_printed integer,
    on_hold text,
    applies_to_doc_type integer,
    applies_to_doc_no_ text,
    bal_account_no_ text,
    receive boolean,
    invoice boolean,
    print_posted_documents boolean,
    receiving_no_ text,
    posting_no_ text,
    last_receiving_no_ text,
    last_posting_no_ text,
    vendor_order_no_ text,
    vendor_shipment_no_ text,
    vendor_invoice_no_ text,
    vendor_cr_memo_no_ text,
    vat_registration_no_ text,
    sell_to_customer_no_ text,
    gen_bus_posting_group text,
    vat_country_region_code text,
    buy_from_vendor_name text,
    buy_from_address text,
    buy_from_address_2 text,
    buy_from_city text,
    buy_from_contact text,
    pay_to_post_code text,
    pay_to_county text,
    pay_to_country_region_code text,
    buy_from_post_code text,
    buy_from_county text,
    buy_from_country_region_code text,
    ship_to_post_code text,
    ship_to_county text,
    ship_to_country_region_code text,
    order_address_code text,
    document_date timestamptz,
    payment_method_code text,
    no_series text,
    posting_no_series text,
    receiving_no_series text,
    status integer,
    invoice_discount_calculation integer,
    invoice_discount_value decimal,
    prepayment_no_ text,
    last_prepayment_no_ text,
    prepmt_cr_memo_no_ text,
    last_prepmt_cr_memo_no_ text,
    prepayment decimal,
    prepayment_no_series text,
    compress_prepayment boolean,
    prepayment_due_date timestamptz,
    prepmt_cr_memo_no_series text,
    prepmt_posting_description text,
    prepmt_pmt_discount_date timestamptz,
    prepmt_payment_terms_code text,
    prepmt_payment_discount decimal,
    incoming_document_entry_no_ integer,
    dimension_set_id integer,
    doc_no_occurrence integer,
    buy_from_contact_no_ text,
    pay_to_contact_no_ text,
    requested_receipt_date timestamptz,
    promised_receipt_date timestamptz,
    lead_time_calculation varchar(32),
    vendor_authorization_no_ text,
    return_shipment_no_series text,
    ship boolean,
    last_return_shipment_no_ text,
    id uuid,
    assigned_user_id text,
    irs_1099_code text,
    rebate_start_date timestamptz,
    rebate_end_date timestamptz,
    disposition_no_ text,
    offering_no_ text,
    rebate_doc_handling integer,
    pricing_confirm text,
    labels_printed boolean,
    order_closed boolean,
    co_op_code text,
    include_qty_for_pick boolean,
    available_date timestamptz,
    manual_available_date smallint,
    priority smallint,
    drop_ship_so_no_ text,
    zone text,
    geographic_code text,
    allow_order_below_minimum boolean,
    edi_order boolean,
    edi_internal_doc_no_ text,
    edi_po_generated boolean,
    edi_po_gen_date timestamptz,
    edi_released boolean,
    edi_ship_adv_gen boolean,
    edi_ship_adv_gen_date timestamptz,
    edi_update_int_doc_no_ text,
    edi_trade_partner text,
    edi_buy_from_code text,
    e_ship_agent_code text,
    e_ship_agent_service text,
    world_wide_service boolean,
    residential_delivery boolean,
    cod_payment boolean,
    cod_cashiers_check smallint,
    shipping_payment_type integer,
    third_party_ship_account_no_ text,
    shipping_insurance integer,
    e_mail_confirmation_handled smallint,
    show_order boolean,
    freight_vendor text,
    freight_amount decimal,
    usda_quote_no_ text,
    usda_po_no_ text,
    CONSTRAINT purchase_header_pkey PRIMARY KEY (source_db, document_type, no_)
);

COMMENT ON TABLE dw2_nav.purchase_header IS 'NAV Table: Purchase Header';


-- =============================================================================
-- INDEXES
-- =============================================================================
-- Indexes on FK columns for query performance
-- Additional indexes can be added based on query patterns
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bid_line_code ON dw2_nav.bid_line (code);
CREATE INDEX IF NOT EXISTS idx_bin_content_bin_code ON dw2_nav.bin_content (bin_code);
CREATE INDEX IF NOT EXISTS idx_bin_content_item_no_ ON dw2_nav.bin_content (item_no_);
CREATE INDEX IF NOT EXISTS idx_bin_content_location_code ON dw2_nav.bin_content (location_code);
CREATE INDEX IF NOT EXISTS idx_bin_location_code ON dw2_nav.bin (location_code);
CREATE INDEX IF NOT EXISTS idx_campaign_no_ ON dw2_nav.campaign (no_);
CREATE INDEX IF NOT EXISTS idx_campaign_target_group_campaign_no_ ON dw2_nav.campaign_target_group (campaign_no_);
CREATE INDEX IF NOT EXISTS idx_co_op_distributor_transaction_bill_to_customer_no_ ON dw2_nav.co_op_distributor_transaction (bill_to_customer_no_);
CREATE INDEX IF NOT EXISTS idx_co_op_distributor_transaction_commodity_ledger_entry_no_ ON dw2_nav.co_op_distributor_transaction (commodity_ledger_entry_no_);
CREATE INDEX IF NOT EXISTS idx_co_op_distributor_transaction_nav_item_no_ ON dw2_nav.co_op_distributor_transaction (nav_item_no_);
CREATE INDEX IF NOT EXISTS idx_commodity_component_parent_item_no_and_item_no_ ON dw2_nav.commodity_component (parent_item_no_and_item_no_);
CREATE INDEX IF NOT EXISTS idx_commodity_ledger_entry_bill_to_customer_no_ ON dw2_nav.commodity_ledger_entry (bill_to_customer_no_);
CREATE INDEX IF NOT EXISTS idx_commodity_ledger_entry_item_no_ ON dw2_nav.commodity_ledger_entry (item_no_);
CREATE INDEX IF NOT EXISTS idx_commodity_ledger_entry_posting_date ON dw2_nav.commodity_ledger_entry (posting_date);
CREATE INDEX IF NOT EXISTS idx_contact_business_relation_contact_no_ ON dw2_nav.contact_business_relation (contact_no_);
CREATE INDEX IF NOT EXISTS idx_contact_no_ ON dw2_nav.contact (no_);
CREATE INDEX IF NOT EXISTS idx_cust_ledger_entry_customer_no_ ON dw2_nav.cust_ledger_entry (customer_no_);
CREATE INDEX IF NOT EXISTS idx_cust_ledger_entry_posting_date ON dw2_nav.cust_ledger_entry (posting_date);
CREATE INDEX IF NOT EXISTS idx_cust_ledger_entry_sell_to_customer_no_ ON dw2_nav.cust_ledger_entry (sell_to_customer_no_);
CREATE INDEX IF NOT EXISTS idx_customer_no_ ON dw2_nav.customer (no_);
CREATE INDEX IF NOT EXISTS idx_default_dimension_no_ ON dw2_nav.default_dimension (no_);
CREATE INDEX IF NOT EXISTS idx_delivery_schedule_source_no_ ON dw2_nav.delivery_schedule (source_no_);
CREATE INDEX IF NOT EXISTS idx_detailed_cust_ledg_entry_cust_ledger_entry_no_ ON dw2_nav.detailed_cust_ledg_entry (cust_ledger_entry_no_);
CREATE INDEX IF NOT EXISTS idx_detailed_cust_ledg_entry_customer_no_ ON dw2_nav.detailed_cust_ledg_entry (customer_no_);
CREATE INDEX IF NOT EXISTS idx_detailed_vendor_ledg_entry_vendor_ledger_entry_no_ ON dw2_nav.detailed_vendor_ledg_entry (vendor_ledger_entry_no_);
CREATE INDEX IF NOT EXISTS idx_detailed_vendor_ledg_entry_vendor_no_ ON dw2_nav.detailed_vendor_ledg_entry (vendor_no_);
CREATE INDEX IF NOT EXISTS idx_dimension_set_entry_dimension_code ON dw2_nav.dimension_set_entry (dimension_code);
CREATE INDEX IF NOT EXISTS idx_dimension_set_entry_dimension_set_id ON dw2_nav.dimension_set_entry (dimension_set_id);
CREATE INDEX IF NOT EXISTS idx_dimension_set_entry_dimension_value_code ON dw2_nav.dimension_set_entry (dimension_value_code);
CREATE INDEX IF NOT EXISTS idx_employee_no_ ON dw2_nav.employee (no_);
CREATE INDEX IF NOT EXISTS idx_g_l_account_no_ ON dw2_nav.g_l_account (no_);
CREATE INDEX IF NOT EXISTS idx_g_l_entry_g_l_account_no_ ON dw2_nav.g_l_entry (g_l_account_no_);
CREATE INDEX IF NOT EXISTS idx_g_l_entry_posting_date ON dw2_nav.g_l_entry (posting_date);
CREATE INDEX IF NOT EXISTS idx_gsf_item_cost_history_item_no_ ON dw2_nav.gsf_item_cost_history (item_no_);
CREATE INDEX IF NOT EXISTS idx_gsf_item_cost_history_location_code ON dw2_nav.gsf_item_cost_history (location_code);
CREATE INDEX IF NOT EXISTS idx_gsf_item_cost_item_no_ ON dw2_nav.gsf_item_cost (item_no_);
CREATE INDEX IF NOT EXISTS idx_gsf_item_cost_location_code ON dw2_nav.gsf_item_cost (location_code);
CREATE INDEX IF NOT EXISTS idx_gsf_item_usage_item_no_ ON dw2_nav.gsf_item_usage (item_no_);
CREATE INDEX IF NOT EXISTS idx_gsf_item_usage_posting_date ON dw2_nav.gsf_item_usage (posting_date);
CREATE INDEX IF NOT EXISTS idx_gsf_sales_price_bill_to_customer_no_ ON dw2_nav.gsf_sales_price (bill_to_customer_no_);
CREATE INDEX IF NOT EXISTS idx_gsf_sales_price_item_no_ ON dw2_nav.gsf_sales_price (item_no_);
CREATE INDEX IF NOT EXISTS idx_item_date_range_item_no_ ON dw2_nav.item_date_range (item_no_);
CREATE INDEX IF NOT EXISTS idx_item_history_no_ ON dw2_nav.item_history (no_);
CREATE INDEX IF NOT EXISTS idx_item_ledger_entry_item_no_ ON dw2_nav.item_ledger_entry (item_no_);
CREATE INDEX IF NOT EXISTS idx_item_ledger_entry_location_code ON dw2_nav.item_ledger_entry (location_code);
CREATE INDEX IF NOT EXISTS idx_item_ledger_entry_posting_date ON dw2_nav.item_ledger_entry (posting_date);
CREATE INDEX IF NOT EXISTS idx_item_no_ ON dw2_nav.item (no_);
CREATE INDEX IF NOT EXISTS idx_item_old_no_ ON dw2_nav.item_old (no_);
CREATE INDEX IF NOT EXISTS idx_item_spec_item_no_ ON dw2_nav.item_spec (item_no_);
CREATE INDEX IF NOT EXISTS idx_item_unit_of_measure_item_no_ ON dw2_nav.item_unit_of_measure (item_no_);
CREATE INDEX IF NOT EXISTS idx_location_code ON dw2_nav.location (code);
CREATE INDEX IF NOT EXISTS idx_lot_no_information_item_no_ ON dw2_nav.lot_no_information (item_no_);
CREATE INDEX IF NOT EXISTS idx_many_tables_dimension_set_id ON dw2_nav.many_tables (dimension_set_id);
CREATE INDEX IF NOT EXISTS idx_pallet_bin_content_item_no_ ON dw2_nav.pallet_bin_content (item_no_);
CREATE INDEX IF NOT EXISTS idx_pallet_bin_content_location ON dw2_nav.pallet_bin_content (location);
CREATE INDEX IF NOT EXISTS idx_pallet_bin_content_location_+_bin ON dw2_nav.pallet_bin_content (location_+_bin);
CREATE INDEX IF NOT EXISTS idx_purch_cr_memo_hdr_buy_from_vendor_no_ ON dw2_nav.purch_cr_memo_hdr (buy_from_vendor_no_);
CREATE INDEX IF NOT EXISTS idx_purch_cr_memo_line_document_no_ ON dw2_nav.purch_cr_memo_line (document_no_);
CREATE INDEX IF NOT EXISTS idx_purch_inv_header_buy_from_vendor_no_ ON dw2_nav.purch_inv_header (buy_from_vendor_no_);
CREATE INDEX IF NOT EXISTS idx_purch_inv_header_posting_date ON dw2_nav.purch_inv_header (posting_date);
CREATE INDEX IF NOT EXISTS idx_purch_inv_line_document_no_ ON dw2_nav.purch_inv_line (document_no_);
CREATE INDEX IF NOT EXISTS idx_purch_inv_line_no_ ON dw2_nav.purch_inv_line (no_);
CREATE INDEX IF NOT EXISTS idx_purch_rcpt_header_posting_date ON dw2_nav.purch_rcpt_header (posting_date);
CREATE INDEX IF NOT EXISTS idx_purch_rcpt_line_document_no_ ON dw2_nav.purch_rcpt_line (document_no_);


-- =============================================================================
-- GIN INDEXES FOR TEXT SEARCH
-- =============================================================================
-- These indexes enable fast full-text search on description and name columns
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_item_description_gin ON dw2_nav.item USING gin (to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_customer_name_gin ON dw2_nav.customer USING gin (to_tsvector('english', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS idx_customer_search_name_gin ON dw2_nav.customer USING gin (to_tsvector('english', coalesce(search_name, '')));
CREATE INDEX IF NOT EXISTS idx_contact_name_gin ON dw2_nav.contact USING gin (to_tsvector('english', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS idx_contact_search_name_gin ON dw2_nav.contact USING gin (to_tsvector('english', coalesce(search_name, '')));
CREATE INDEX IF NOT EXISTS idx_location_name_gin ON dw2_nav.location USING gin (to_tsvector('english', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS idx_g_l_account_name_gin ON dw2_nav.g_l_account USING gin (to_tsvector('english', coalesce(name, '')));
CREATE INDEX IF NOT EXISTS idx_g_l_account_search_name_gin ON dw2_nav.g_l_account USING gin (to_tsvector('english', coalesce(search_name, '')));
CREATE INDEX IF NOT EXISTS idx_campaign_description_gin ON dw2_nav.campaign USING gin (to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_bin_description_gin ON dw2_nav.bin USING gin (to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_item_ledger_entry_description_gin ON dw2_nav.item_ledger_entry USING gin (to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_purch_inv_header_posting_description_gin ON dw2_nav.purch_inv_header USING gin (to_tsvector('english', coalesce(posting_description, '')));


-- =============================================================================
-- END OF SCHEMA DEFINITION
-- =============================================================================