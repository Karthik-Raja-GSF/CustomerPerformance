/*
  Warnings:

  - You are about to drop the `acc_schedule_line` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `accounting_period` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `appointment_schedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bank_account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bid_header` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bid_line` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bin_content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bin_type` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `campaign_target_group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `change_log_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `change_log_entry_full_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `co_op_distributor_transaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commodity_amt_limit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commodity_component` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commodity_lb_limit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commodity_ledger_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `commodity_opt_out` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contact` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `contact_business_relation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cust_ledger_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `customer_grouping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `default_dimension` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `delivery_schedule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `detailed_cust_ledg_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `detailed_vendor_ledg_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dimension_set_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dimension_value` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `employee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fixed_asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `g_l_account` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `g_l_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gsf_item_cost` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gsf_item_cost_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gsf_item_usage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gsf_sales_price` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_application_entry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_charge` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_date_range` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_grouping` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_old` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_spec` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `item_unit_of_measure` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `location` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lot_no_information` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pallet_movement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purch_cr_memo_hdr` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purch_cr_memo_line` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purch_inv_header` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purch_inv_line` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `purch_rcpt_line` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "dw2_nav"."acc_schedule_line";

-- DropTable
DROP TABLE "dw2_nav"."accounting_period";

-- DropTable
DROP TABLE "dw2_nav"."appointment_schedule";

-- DropTable
DROP TABLE "dw2_nav"."bank_account";

-- DropTable
DROP TABLE "dw2_nav"."bid_header";

-- DropTable
DROP TABLE "dw2_nav"."bid_line";

-- DropTable
DROP TABLE "dw2_nav"."bin";

-- DropTable
DROP TABLE "dw2_nav"."bin_content";

-- DropTable
DROP TABLE "dw2_nav"."bin_type";

-- DropTable
DROP TABLE "dw2_nav"."campaign";

-- DropTable
DROP TABLE "dw2_nav"."campaign_target_group";

-- DropTable
DROP TABLE "dw2_nav"."change_log_entry";

-- DropTable
DROP TABLE "dw2_nav"."change_log_entry_full_history";

-- DropTable
DROP TABLE "dw2_nav"."co_op_distributor_transaction";

-- DropTable
DROP TABLE "dw2_nav"."commodity_amt_limit";

-- DropTable
DROP TABLE "dw2_nav"."commodity_component";

-- DropTable
DROP TABLE "dw2_nav"."commodity_lb_limit";

-- DropTable
DROP TABLE "dw2_nav"."commodity_ledger_entry";

-- DropTable
DROP TABLE "dw2_nav"."commodity_opt_out";

-- DropTable
DROP TABLE "dw2_nav"."contact";

-- DropTable
DROP TABLE "dw2_nav"."contact_business_relation";

-- DropTable
DROP TABLE "dw2_nav"."cust_ledger_entry";

-- DropTable
DROP TABLE "dw2_nav"."customer_grouping";

-- DropTable
DROP TABLE "dw2_nav"."default_dimension";

-- DropTable
DROP TABLE "dw2_nav"."delivery_schedule";

-- DropTable
DROP TABLE "dw2_nav"."detailed_cust_ledg_entry";

-- DropTable
DROP TABLE "dw2_nav"."detailed_vendor_ledg_entry";

-- DropTable
DROP TABLE "dw2_nav"."dimension_set_entry";

-- DropTable
DROP TABLE "dw2_nav"."dimension_value";

-- DropTable
DROP TABLE "dw2_nav"."employee";

-- DropTable
DROP TABLE "dw2_nav"."fixed_asset";

-- DropTable
DROP TABLE "dw2_nav"."g_l_account";

-- DropTable
DROP TABLE "dw2_nav"."g_l_entry";

-- DropTable
DROP TABLE "dw2_nav"."gsf_item_cost";

-- DropTable
DROP TABLE "dw2_nav"."gsf_item_cost_history";

-- DropTable
DROP TABLE "dw2_nav"."gsf_item_usage";

-- DropTable
DROP TABLE "dw2_nav"."gsf_sales_price";

-- DropTable
DROP TABLE "dw2_nav"."item_application_entry";

-- DropTable
DROP TABLE "dw2_nav"."item_charge";

-- DropTable
DROP TABLE "dw2_nav"."item_date_range";

-- DropTable
DROP TABLE "dw2_nav"."item_grouping";

-- DropTable
DROP TABLE "dw2_nav"."item_history";

-- DropTable
DROP TABLE "dw2_nav"."item_old";

-- DropTable
DROP TABLE "dw2_nav"."item_spec";

-- DropTable
DROP TABLE "dw2_nav"."item_unit_of_measure";

-- DropTable
DROP TABLE "dw2_nav"."location";

-- DropTable
DROP TABLE "dw2_nav"."lot_no_information";

-- DropTable
DROP TABLE "dw2_nav"."pallet_movement";

-- DropTable
DROP TABLE "dw2_nav"."purch_cr_memo_hdr";

-- DropTable
DROP TABLE "dw2_nav"."purch_cr_memo_line";

-- DropTable
DROP TABLE "dw2_nav"."purch_inv_header";

-- DropTable
DROP TABLE "dw2_nav"."purch_inv_line";

-- DropTable
DROP TABLE "dw2_nav"."purch_rcpt_line";

-- CreateTable
CREATE TABLE "dw2_nav"."transfer_header" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "no_" TEXT NOT NULL,
    "transfer_from_code" TEXT,
    "transfer_to_code" TEXT,
    "posting_date" TIMESTAMP(3),
    "shipment_date" TIMESTAMP(3),
    "receipt_date" TIMESTAMP(3),

    CONSTRAINT "transfer_header_pkey" PRIMARY KEY ("source_db","no_")
);

-- CreateTable
CREATE TABLE "dw2_nav"."sales_price" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "item_no_" TEXT NOT NULL,
    "sales_type" INTEGER NOT NULL,
    "sales_code" TEXT NOT NULL,
    "starting_date" TIMESTAMP(3) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "variant_code" TEXT NOT NULL,
    "unit_of_measure_code" TEXT NOT NULL,
    "minimum_quantity" DECIMAL(65,30) NOT NULL,
    "unit_price" DECIMAL(65,30),
    "price_includes_vat" BOOLEAN,
    "allow_invoice_disc_" BOOLEAN,
    "ending_date" TIMESTAMP(3),
    "allow_line_disc_" BOOLEAN,
    "fob_cost" DECIMAL(65,30),
    "delivered_cost" DECIMAL(65,30),
    "rebate_amount" DECIMAL(65,30),
    "fee_for_service" DECIMAL(65,30),
    "customer_bid_no_" TEXT,
    "comment" TEXT,
    "mfg_bid_no_" TEXT,
    "mfg_item_no_" TEXT,
    "customer_bid_qty_" DECIMAL(65,30),
    "contract_expiration_date" TIMESTAMP(3),
    "item_pack_size" TEXT,
    "bid_line_no_" TEXT,
    "price_id" INTEGER,
    "price_type" INTEGER,
    "pricing_method" INTEGER,
    "njpa_cost" DECIMAL(65,30),
    "njpa_super_cost" DECIMAL(65,30),
    "contract_spec" INTEGER,
    "price_per_pound" DECIMAL(65,30),

    CONSTRAINT "sales_price_pkey" PRIMARY KEY ("source_db","item_no_","sales_type","sales_code","starting_date","currency_code","variant_code","unit_of_measure_code","minimum_quantity")
);

-- CreateTable
CREATE TABLE "dw2_nav"."short_ship" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "invoice_no_" TEXT NOT NULL,
    "item_no_" TEXT NOT NULL,
    "line_no_" INTEGER NOT NULL,
    "bill_to_customer_no_" TEXT,
    "bill_to_name" TEXT,
    "sell_to_customer_no_" TEXT,
    "sell_to_name" TEXT,
    "invoice_date" TIMESTAMP(3),
    "csr" TEXT,
    "order_quantity" DECIMAL(65,30),
    "shipped_quantity" DECIMAL(65,30),
    "short_ship_quantity" DECIMAL(65,30),
    "short_ship_reason_code" TEXT,
    "reviewed" INTEGER,
    "reviewed_by" TEXT,
    "external_document_no_" TEXT,
    "reviewed_date" TIMESTAMP(3),
    "location_code" TEXT,
    "route_no_" TEXT,
    "stop_no_" TEXT,
    "shipment_date" TIMESTAMP(3),
    "buyer_code" TEXT,
    "suggested_sub" TEXT,
    "bin_code" TEXT,
    "cross_reference_no_" TEXT,
    "substitution_reason_code" TEXT,
    "datetime_printed" TIMESTAMP(3),

    CONSTRAINT "short_ship_pkey" PRIMARY KEY ("source_db","invoice_no_","item_no_","line_no_")
);

-- CreateTable
CREATE TABLE "dw2_nav"."stockkeeping_unit" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "location_code" TEXT NOT NULL,
    "item_no_" TEXT NOT NULL,
    "variant_code" TEXT NOT NULL,
    "shelf_no_" TEXT,
    "unit_cost" DECIMAL(65,30),
    "standard_cost" DECIMAL(65,30),
    "last_direct_cost" DECIMAL(65,30),
    "vendor_no_" TEXT,
    "vendor_item_no_" TEXT,
    "lead_time_calculation" VARCHAR(32),
    "reorder_point" DECIMAL(65,30),
    "maximum_inventory" DECIMAL(65,30),
    "reorder_quantity" DECIMAL(65,30),
    "minimum_order_quantity" DECIMAL(65,30),
    "maximum_order_quantity" DECIMAL(65,30),
    "safety_stock_quantity" DECIMAL(65,30),
    "order_multiple" DECIMAL(65,30),
    "safety_lead_time" VARCHAR(32),
    "reordering_policy" INTEGER,
    "include_inventory" BOOLEAN,
    "use_cross_docking" BOOLEAN,
    "blocked" INTEGER,
    "specials_list" INTEGER,
    "special_order" INTEGER,
    "velocity" TEXT,
    "status" TEXT,
    "pallet_ti" INTEGER,
    "pallet_hi" INTEGER,
    "always_putaway_to_pick" INTEGER,
    "new_velocity" TEXT,
    "pick_zone_code" TEXT,
    "customer_lead_time" INTEGER,
    "suggested_weeks_on_hand" DECIMAL(65,30),
    "hot_deals" INTEGER,
    "transfer_from_code" TEXT,
    "conditional_status" TEXT,
    "challenge_status" TEXT,
    "last_date_modified" TIMESTAMP(3),
    "pounds" DECIMAL(65,30),
    "siq_order_policy" TEXT,

    CONSTRAINT "stockkeeping_unit_pkey" PRIMARY KEY ("source_db","location_code","item_no_","variant_code")
);

-- CreateTable
CREATE TABLE "dw2_nav"."vendor" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "no_" TEXT NOT NULL,
    "name" TEXT,
    "search_name" TEXT,
    "name_2" TEXT,
    "address" TEXT,
    "address_2" TEXT,
    "city" TEXT,
    "contact" TEXT,
    "phone_no_" TEXT,
    "our_account_no_" TEXT,
    "global_dimension_1_code" TEXT,
    "global_dimension_2_code" TEXT,
    "vendor_posting_group" TEXT,
    "payment_terms_code" TEXT,
    "purchaser_code" TEXT,
    "shipment_method_code" TEXT,
    "invoice_disc_code" TEXT,
    "blocked" INTEGER,
    "pay_to_vendor_no_" TEXT,
    "priority" INTEGER,
    "payment_method_code" TEXT,
    "gen_bus_posting_group" TEXT,
    "post_code" TEXT,
    "county" TEXT,
    "e_mail" TEXT,
    "home_page" TEXT,
    "primary_contact_no_" TEXT,
    "location_code" TEXT,
    "lead_time_calculation" VARCHAR(32),
    "payment_terms_id" TEXT,
    "payment_method_id" TEXT,
    "federal_id_no_" TEXT,
    "unipro_supplier" INTEGER,
    "duns_bradstreet_no_" TEXT,
    "default_g_l_account" TEXT,
    "maximum_order_amount" DECIMAL(65,30),
    "default_delivery" TEXT,
    "geographic_code" TEXT,
    "default_fee_for_service" DECIMAL(65,30),
    "vendor_group_code" TEXT,
    "commodity_manufacturer_code" TEXT,
    "rebate_doc_handling" INTEGER,
    "vendor_class" TEXT,
    "ap_rep" TEXT,
    "legacy_no_" TEXT,
    "external_no_" TEXT,
    "certified_organic" INTEGER,
    "small_business_enterprise_sbe" INTEGER,
    "minority_owned_mbe" INTEGER,
    "woman_owned_wbe" INTEGER,
    "veteran_owned_vosb" INTEGER,
    "disab_owned_bus_ent_dobe" INTEGER,
    "family_owned_business" INTEGER,
    "vendor_credit_limit" DECIMAL(65,30),

    CONSTRAINT "vendor_pkey" PRIMARY KEY ("source_db","no_")
);

-- CreateTable
CREATE TABLE "dw2_nav"."sales_header" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "document_type" INTEGER NOT NULL,
    "no_" TEXT NOT NULL,
    "sell_to_customer_no_" TEXT,
    "bill_to_customer_no_" TEXT,
    "bill_to_name" TEXT,
    "bill_to_name_2" TEXT,
    "bill_to_address" TEXT,
    "bill_to_address_2" TEXT,
    "bill_to_city" TEXT,
    "bill_to_contact" TEXT,
    "ship_to_name" TEXT,
    "ship_to_name_2" TEXT,
    "ship_to_address" TEXT,
    "ship_to_address_2" TEXT,
    "ship_to_city" TEXT,
    "ship_to_contact" TEXT,
    "order_date" TIMESTAMP(3),
    "posting_date" TIMESTAMP(3),
    "shipment_date" TIMESTAMP(3),
    "posting_description" TEXT,
    "payment_terms_code" TEXT,
    "due_date" TIMESTAMP(3),
    "pmt_discount_date" TIMESTAMP(3),
    "shipment_method_code" TEXT,
    "location_code" TEXT,
    "shortcut_dimension_1_code" TEXT,
    "shortcut_dimension_2_code" TEXT,
    "customer_posting_group" TEXT,
    "invoice_disc_code" TEXT,
    "salesperson_code" TEXT,
    "sell_to_customer_name" TEXT,
    "sell_to_customer_name_2" TEXT,
    "sell_to_address" TEXT,
    "sell_to_address_2" TEXT,
    "sell_to_city" TEXT,
    "sell_to_contact" TEXT,
    "bill_to_post_code" TEXT,
    "bill_to_county" TEXT,
    "bill_to_country_region_code" TEXT,
    "sell_to_post_code" TEXT,
    "sell_to_county" TEXT,
    "sell_to_country_region_code" TEXT,
    "ship_to_post_code" TEXT,
    "ship_to_county" TEXT,
    "ship_to_country_region_code" TEXT,
    "document_date" TIMESTAMP(3),
    "external_document_no_" TEXT,
    "payment_method_code" TEXT,
    "assigned_user_id" TEXT,
    "original_invoice_no_" TEXT,
    "order_type" TEXT,
    "csr" TEXT,
    "customer_order_no_" TEXT,
    "price_at_shipment" INTEGER,
    "route_no_" TEXT,
    "stop_no_" TEXT,
    "sodexo_customer" INTEGER,
    "order_date_time" TIMESTAMP(3),
    "special_instructions" TEXT,
    "drop_ship_po_no_" TEXT,
    "vendor_sample" INTEGER,
    "gsf_sample" INTEGER,
    "route_error" INTEGER,
    "driver" TEXT,
    "last_page_no_" INTEGER,
    "invoice_type" TEXT,
    "true_posting_date_time" TIMESTAMP(3),
    "edi_order" BOOLEAN,
    "edi_internal_doc_no_" TEXT,
    "edi_invoice_generated" BOOLEAN,
    "edi_inv_gen_date" TIMESTAMP(3),
    "edi_ack_generated" INTEGER,
    "edi_ack_gen_date" TIMESTAMP(3),
    "edi_whse_shp_gen" INTEGER,
    "edi_whse_shp_gen_date" TIMESTAMP(3),
    "edi_trade_partner" TEXT,
    "edi_sell_to_code" TEXT,
    "edi_ship_to_code" TEXT,
    "edi_ship_for_code" TEXT,
    "edi_invoice" INTEGER,
    "edi_transaction_date" TIMESTAMP(3),
    "edi_transaction_time" TIMESTAMP(3),
    "online_order_no_" TEXT,
    "pas_override_reason" TEXT,
    "original_order_no_" TEXT,
    "customer_po_2" TEXT,
    "rebate_start_date" TIMESTAMP(3),
    "rebate_end_date" TIMESTAMP(3),

    CONSTRAINT "sales_header_pkey" PRIMARY KEY ("source_db","document_type","no_")
);

-- CreateTable
CREATE TABLE "dw2_nav"."sales_invoice_header" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "no_" TEXT NOT NULL,
    "sell_to_customer_no_" TEXT,
    "bill_to_customer_no_" TEXT,
    "bill_to_name" TEXT,
    "bill_to_name_2" TEXT,
    "bill_to_address" TEXT,
    "bill_to_address_2" TEXT,
    "bill_to_city" TEXT,
    "bill_to_contact" TEXT,
    "ship_to_name" TEXT,
    "ship_to_name_2" TEXT,
    "ship_to_address" TEXT,
    "ship_to_address_2" TEXT,
    "ship_to_city" TEXT,
    "ship_to_contact" TEXT,
    "order_date" TIMESTAMP(3),
    "posting_date" TIMESTAMP(3),
    "shipment_date" TIMESTAMP(3),
    "posting_description" TEXT,
    "payment_terms_code" TEXT,
    "due_date" TIMESTAMP(3),
    "shipment_method_code" TEXT,
    "location_code" TEXT,
    "shortcut_dimension_1_code" TEXT,
    "shortcut_dimension_2_code" TEXT,
    "customer_posting_group" TEXT,
    "customer_price_group" TEXT,
    "invoice_disc_code" TEXT,
    "salesperson_code" TEXT,
    "order_no_" TEXT,
    "no_printed" INTEGER,
    "reason_code" TEXT,
    "gen_bus_posting_group" TEXT,
    "sell_to_customer_name" TEXT,
    "sell_to_customer_name_2" TEXT,
    "sell_to_address" TEXT,
    "sell_to_address_2" TEXT,
    "sell_to_city" TEXT,
    "sell_to_contact" TEXT,
    "bill_to_post_code" TEXT,
    "bill_to_county" TEXT,
    "sell_to_post_code" TEXT,
    "sell_to_county" TEXT,
    "ship_to_post_code" TEXT,
    "ship_to_county" TEXT,
    "document_date" TIMESTAMP(3),
    "external_document_no_" TEXT,
    "shipping_agent_code" TEXT,
    "no_series" TEXT,
    "user_id" TEXT,
    "source_code" TEXT,
    "tax_area_code" TEXT,
    "tax_liable" BOOLEAN,
    "dimension_set_id" INTEGER,
    "cust_ledger_entry_no_" INTEGER,
    "campaign_no_" TEXT,
    "sell_to_contact_no_" TEXT,
    "bill_to_contact_no_" TEXT,
    "opportunity_no_" TEXT,
    "responsibility_center" TEXT,
    "allow_line_disc_" BOOLEAN,
    "original_invoice_no_" TEXT,
    "created_from_credit_no_" TEXT,
    "rebate_type" INTEGER,
    "rebate_start_date" TIMESTAMP(3),

    CONSTRAINT "sales_invoice_header_pkey" PRIMARY KEY ("source_db","no_")
);

-- CreateTable
CREATE TABLE "dw2_nav"."sales_line" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "document_type" INTEGER NOT NULL,
    "document_no_" TEXT NOT NULL,
    "line_no_" INTEGER NOT NULL,
    "sell_to_customer_no_" TEXT,
    "type" INTEGER,
    "no_" TEXT,
    "location_code" TEXT,
    "posting_group" TEXT,
    "shipment_date" TIMESTAMP(3),
    "description" TEXT,
    "description_2" TEXT,
    "unit_of_measure" TEXT,
    "quantity" DECIMAL(65,30),
    "unit_price" DECIMAL(65,30),
    "unit_cost_lcy" DECIMAL(65,30),
    "vat_" DECIMAL(65,30),
    "line_discount_" DECIMAL(65,30),
    "line_discount_amount" DECIMAL(65,30),
    "amount" DECIMAL(65,30),
    "amount_including_vat" DECIMAL(65,30),
    "allow_invoice_disc_" BOOLEAN,
    "gross_weight" DECIMAL(65,30),
    "net_weight" DECIMAL(65,30),
    "units_per_parcel" DECIMAL(65,30),
    "unit_volume" DECIMAL(65,30),
    "shortcut_dimension_1_code" TEXT,
    "shortcut_dimension_2_code" TEXT,
    "bill_to_customer_no_" TEXT,
    "gen_bus_posting_group" TEXT,
    "gen_prod_posting_group" TEXT,
    "vat_calculation_type" INTEGER,
    "attached_to_line_no_" INTEGER,
    "tax_area_code" TEXT,
    "tax_liable" BOOLEAN,
    "tax_group_code" TEXT,
    "vat_base_amount" DECIMAL(65,30),
    "unit_cost" DECIMAL(65,30),
    "line_amount" DECIMAL(65,30),
    "vat_difference" DECIMAL(65,30),
    "dimension_set_id" INTEGER,
    "variant_code" TEXT,
    "bin_code" TEXT,
    "qty_per_unit_of_measure" DECIMAL(65,30),
    "unit_of_measure_code" TEXT,
    "quantity_base" DECIMAL(65,30),
    "item_category_code" TEXT,
    "product_group_code" TEXT,
    "return_reason_code" TEXT,
    "allow_line_disc_" BOOLEAN,
    "do_not_print" INTEGER,
    "contract_price" INTEGER,
    "order_type" TEXT,
    "price_coop_no_" TEXT,
    "commodity_line_type" INTEGER,
    "commodity_line_for_line_no_" INTEGER,
    "commodity_kit_qty_base" DECIMAL(65,30),
    "edi_uom" TEXT,
    "crv_related_to_line_no_" INTEGER,
    "short_ship_reason_code" TEXT,
    "item_substituted" INTEGER,
    "item_substitute_item_no_" TEXT,
    "substitute_line_number" INTEGER,
    "substitute_item_line_no_" INTEGER,
    "substitute_for_item_no_" TEXT,
    "substitution_reason_code" TEXT,
    "zone" TEXT,
    "vendor_sample" INTEGER,
    "gsf_sample" INTEGER,
    "vendor_group_code" TEXT,
    "commodity_amount" DECIMAL(65,30),
    "commodity_lbs" DECIMAL(65,30),
    "dont_use_commodity" INTEGER,
    "price_id" INTEGER,
    "do_not_pick" INTEGER,
    "qty_to_pick" DECIMAL(65,30),
    "original_quantity" DECIMAL(65,30),
    "item_vendor_no_" TEXT,
    "lot_no_" TEXT,
    "co_op_district_quantity_code" TEXT,
    "co_op_district_amount_code" TEXT,
    "skipped_lead_time_check" INTEGER,
    "pounds" DECIMAL(65,30),
    "price_per_pound" DECIMAL(65,30),
    "package_quantity" DECIMAL(65,30),
    "substitute_for_order_no_" TEXT,
    "hot_deals" INTEGER,
    "outstanding_quantity" DECIMAL(65,30),

    CONSTRAINT "sales_line_pkey" PRIMARY KEY ("source_db","document_type","document_no_","line_no_")
);
