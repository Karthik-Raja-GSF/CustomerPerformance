# GSF NAV DW2 PostgreSQL Schema Documentation

**Author:** Bakhrom Botirov  
**Date:** 12/08/2025

---

**Database:** ait_db  
**Schema:** dw2_nav  
**Source:** Microsoft Dynamics NAV Data Warehouse (DW2.nav)  
**Total Tables:** 60

---

## Table of Contents

1. [Overview](#overview)
2. [Data Type Mappings](#data-type-mappings)
3. [Schema Conventions](#schema-conventions)
4. [Tables by Domain](#tables-by-domain)
5. [Relationships](#relationships)
6. [Table Specifications](#table-specifications)
7. [Indexes](#indexes)
8. [Migration Notes](#migration-notes)

---

## Overview

This schema represents the PostgreSQL conversion of Gold Star Foods' Microsoft Dynamics NAV Data Warehouse (DW2). The schema is designed for:

- **Read Replication**: Primary use case via AWS Aurora PostgreSQL
- **DMS Compatibility**: Structured for AWS Database Migration Service
- **Query Performance**: Optimized indexes on FK columns and common query patterns
- **Data Integrity**: Preserved original NAV structure and naming conventions

### Key Statistics

| Metric                   | Value |
| ------------------------ | ----- |
| Total Tables             | 60    |
| Total Columns            | 1963  |
| Business Domains         | 11    |
| Tables with Composite PK | 27    |

---

## Data Type Mappings

| MS SQL Server      | PostgreSQL    | Notes                                           |
| ------------------ | ------------- | ----------------------------------------------- |
| `nvarchar(n)`      | `text`        | PostgreSQL optimizes text storage internally    |
| `varchar(n)`       | `text`        | Except varchar(32) for DateFormula fields       |
| `varchar(32)`      | `varchar(32)` | Preserved for NAV DateFormula (Lead Time, etc.) |
| `datetime`         | `timestamptz` | GSF operates in multiple timezones              |
| `datetime2`        | `timestamptz` | With timezone for consistency                   |
| `int`              | `integer`     | Standard 32-bit integer                         |
| `bigint`           | `bigint`      | 64-bit integer                                  |
| `tinyint` (flags)  | `boolean`     | For boolean flags (blocked, open, etc.)         |
| `tinyint` (enums)  | `smallint`    | For enumeration values                          |
| `decimal`          | `decimal`     | Without precision (arbitrary precision)         |
| `uniqueidentifier` | `uuid`        | Native UUID type                                |

---

## Schema Conventions

### Naming Conventions

| Element      | Convention                  | Example                    |
| ------------ | --------------------------- | -------------------------- |
| Schema       | `dw2_nav`                   | `dw2_nav.customer`         |
| Tables       | snake_case (no prefix)      | `purch_inv_header`         |
| Columns      | snake_case (preserving NAV) | `bill_to_customer_no_`     |
| Primary Keys | `table_pkey`                | `customer_pkey`            |
| Indexes      | `idx_table_column`          | `idx_customer_no_`         |
| GIN Indexes  | `idx_table_column_gin`      | `idx_item_description_gin` |

### NAV Naming Preservation

The following NAV naming patterns are preserved:

- `no_` suffix for number/code fields
- `qty_` prefix for quantity fields
- `purch_` prefix for purchasing fields
- `inv_` for invoice
- `rcpt_` for receipt
- `hdr_` for header

---

## Tables by Domain

### Master Data

| Original Table | PostgreSQL Table | Columns | Primary Key     |
| -------------- | ---------------- | ------- | --------------- |
| Item           | `item`           | 108     | source*db, no*  |
| Customer       | `customer`       | 82      | source*db, no*  |
| Location       | `location`       | 127     | source_db, code |
| Employee       | `employee`       | 12      | source*db, no*  |
| Contact        | `contact`        | 30      | source*db, no*  |
| Bank Account   | `bank_account`   | 10      | source*db, no*  |
| Fixed Asset    | `fixed_asset`    | 21      | source*db, no*  |
| G_L Account    | `g_l_account`    | 22      | source*db, no*  |

### Item Extensions (GSF Custom)

| Original Table        | PostgreSQL Table        | Columns | Primary Key                                    |
| --------------------- | ----------------------- | ------- | ---------------------------------------------- |
| Item Spec             | `item_spec`             | 66      | source*db, item_no*                            |
| Item Unit of Measure  | `item_unit_of_measure`  | 13      | source*db, item_no*, code                      |
| Item History          | `item_history`          | 108     |                                                |
| Item OLD              | `item_old`              | 103     | source*db, no*                                 |
| Item Date Range       | `item_date_range`       | 9       | source*db, item_no*, code, ...                 |
| Item Grouping         | `item_grouping`         | 7       | source_db, type, code, ...                     |
| Item Charge           | `item_charge`           | 10      | source*db, no*                                 |
| GSF Item Cost         | `gsf_item_cost`         | 10      | source*db, location_code, item_no*, ...        |
| GSF Item Cost History | `gsf_item_cost_history` | 10      |                                                |
| GSF Item Usage        | `gsf_item_usage`        | 19      | source*db, entry_no*                           |
| GSF Sales Price       | `gsf_sales_price`       | 11      | source*db, bill_to_customer_no*, item*no*, ... |

### Warehouse & Inventory

| Original Table       | PostgreSQL Table     | Columns | Primary Key                             |
| -------------------- | -------------------- | ------- | --------------------------------------- |
| Bin                  | `bin`                | 36      | source_db, location_code, code          |
| Bin Content          | `bin_content`        | 24      | source_db, location_code, bin_code, ... |
| Bin Type             | `bin_type`           | 10      | source_db, code                         |
| Pallet Bin Content   | `pallet_bin_content` | 28      | source_db, bin, location, ...           |
| Pallet Movement      | `pallet_movement`    | 24      | source*db, entry_no*                    |
| Lot No\_ Information | `lot_no_information` | 14      | source*db, item_no*, variant_code, ...  |

### Ledger Entries

| Original Table                  | PostgreSQL Table                | Columns | Primary Key          |
| ------------------------------- | ------------------------------- | ------- | -------------------- |
| Item Ledger Entry               | `item_ledger_entry`             | 47      | source*db, entry_no* |
| Item Application Entry          | `item_application_entry`        | 16      | source*db, entry_no* |
| Cust\_ Ledger Entry             | `cust_ledger_entry`             | 44      | source*db, entry_no* |
| Detailed Cust* Ledg* Entry      | `detailed_cust_ledg_entry`      | 32      | source*db, entry_no* |
| Detailed Vendor Ledg\_ Entry    | `detailed_vendor_ledg_entry`    | 34      | source*db, entry_no* |
| G_L Entry                       | `g_l_entry`                     | 28      | source*db, entry_no* |
| Change Log Entry                | `change_log_entry`              | 16      | source*db, entry_no* |
| Change Log Entry (Full History) | `change_log_entry_full_history` | 16      | source*db, entry_no* |

### Purchasing

| Original Table        | PostgreSQL Table     | Columns | Primary Key                       |
| --------------------- | -------------------- | ------- | --------------------------------- |
| Purchase Header       | `purchase_header`    | 147     | source*db, document_type, no*     |
| Purch* Inv* Header    | `purch_inv_header`   | 93      | source*db, no*                    |
| Purch* Inv* Line      | `purch_inv_line`     | 59      | source*db, document_no*, line*no* |
| Purch* Rcpt* Header   | `purch_rcpt_header`  | 72      | source*db, no*                    |
| Purch* Rcpt* Line     | `purch_rcpt_line`    | 74      | source*db, document_no*, line*no* |
| Purch* Cr* Memo Hdr\_ | `purch_cr_memo_hdr`  | 68      | source*db, no*                    |
| Purch* Cr* Memo Line  | `purch_cr_memo_line` | 59      | source*db, document_no*, line*no* |

### Dimensions

| Original Table      | PostgreSQL Table      | Columns | Primary Key                                 |
| ------------------- | --------------------- | ------- | ------------------------------------------- |
| Dimension Value     | `dimension_value`     | 12      | source_db, dimension_code, code             |
| Dimension Set Entry | `dimension_set_entry` | 6       | source_db, dimension_set_id, dimension_code |
| Default Dimension   | `default_dimension`   | 8       | source*db, table_id, no*, ...               |

### Commodity/USDA

| Original Table                | PostgreSQL Table                | Columns | Primary Key                                                     |
| ----------------------------- | ------------------------------- | ------- | --------------------------------------------------------------- |
| Commodity Ledger Entry        | `commodity_ledger_entry`        | 29      | source*db, entry_no*                                            |
| Commodity Component           | `commodity_component`           | 9       | source*db, parent_item_no*, vendor*no*, ...                     |
| Commodity AMT Limit           | `commodity_amt_limit`           | 3       | source_db, co_op_district_amt_code                              |
| Commodity LB Limit            | `commodity_lb_limit`            | 5       | source_db, co_op_district_quantity_code, vendor_group_code, ... |
| Commodity Opt Out             | `commodity_opt_out`             | 6       | source_db, co_op_district_group_code, vendor_group_code, ...    |
| Co-op Distributor Transaction | `co_op_distributor_transaction` | 27      | source*db, manufacturer_code, recipient_agency_no*, ...         |

### Pricing

| Original Table | PostgreSQL Table | Columns | Primary Key                     |
| -------------- | ---------------- | ------- | ------------------------------- |
| Bid Header     | `bid_header`     | 10      | source_db, code                 |
| Bid Line       | `bid_line`       | 25      | source_db, code, item_type, ... |

### CRM & Campaigns

| Original Table            | PostgreSQL Table            | Columns | Primary Key                                    |
| ------------------------- | --------------------------- | ------- | ---------------------------------------------- |
| Campaign                  | `campaign`                  | 14      | source*db, no*                                 |
| Campaign Target Group     | `campaign_target_group`     | 6       | source*db, type, no*, ...                      |
| Contact Business Relation | `contact_business_relation` | 6       | source*db, contact_no*, business_relation_code |

### Other/Configuration

| Original Table       | PostgreSQL Table       | Columns | Primary Key                         |
| -------------------- | ---------------------- | ------- | ----------------------------------- |
| Accounting Period    | `accounting_period`    | 9       | source_db, starting_date            |
| Acc\_ Schedule Line  | `acc_schedule_line`    | 24      | source*db, schedule_name, line_no*  |
| Appointment Schedule | `appointment_schedule` | 9       | source_db, location_code, code, ... |
| Customer Grouping    | `customer_grouping`    | 8       | source_db, type, code, ...          |
| Delivery Schedule    | `delivery_schedule`    | 21      | source*db, type, source_no*, ...    |

---

## Relationships

### Document Header-Line Relationships

| Parent Table       | Parent Key | Child Table        | Child Key    | Cardinality |
| ------------------ | ---------- | ------------------ | ------------ | ----------- |
| bid_header         | code       | bid_line           | code         | 1:N         |
| purch_inv_header   | no\_       | purch_inv_line     | document*no* | 1:N         |
| purch_rcpt_header  | no\_       | purch_rcpt_line    | document*no* | 1:N         |
| purch*cr_memo_hdr* | no\_       | purch_cr_memo_line | document*no* | 1:N         |

### Item Master Relationships

| Parent Table | Parent Key | Child Table            | Child Key | Cardinality |
| ------------ | ---------- | ---------------------- | --------- | ----------- |
| item         | no\_       | item_ledger_entry      | item*no*  | 1:N         |
| item         | no\_       | item_spec              | item*no*  | 1:1         |
| item         | no\_       | item_unit_of_measure   | item*no*  | 1:N         |
| item         | no\_       | gsf_item_cost          | item*no*  | 1:N         |
| item         | no\_       | gsf_sales_price        | item*no*  | 1:N         |
| item         | no\_       | gsf_item_usage         | item*no*  | 1:N         |
| item         | no\_       | bin_content            | item*no*  | 1:N         |
| item         | no\_       | commodity_ledger_entry | item*no*  | 1:N         |
| item         | no\_       | bid_line               | item_code | 1:N         |

### Customer Master Relationships

| Parent Table | Parent Key | Child Table              | Child Key            | Cardinality |
| ------------ | ---------- | ------------------------ | -------------------- | ----------- |
| customer     | no\_       | cust_ledger_entry        | customer*no*         | 1:N         |
| customer     | no\_       | detailed_cust_ledg_entry | customer*no*         | 1:N         |
| customer     | no\_       | gsf_sales_price          | bill*to_customer_no* | 1:N         |
| customer     | no\_       | commodity_ledger_entry   | bill*to_customer_no* | 1:N         |
| customer     | no\_       | campaign_target_group    | no\_                 | 1:N         |

### Location/Warehouse Relationships

| Parent Table | Parent Key          | Child Table       | Child Key               | Cardinality |
| ------------ | ------------------- | ----------------- | ----------------------- | ----------- |
| location     | code                | bin               | location_code           | 1:N         |
| location     | code                | bin_content       | location_code           | 1:N         |
| location     | code                | item_ledger_entry | location_code           | 1:N         |
| location     | code                | gsf_item_cost     | location_code           | 1:N         |
| bin          | location_code, code | bin_content       | location_code, bin_code | 1:N         |
| bin_type     | code                | bin               | bin_type_code           | 1:N         |

### Ledger Entry Relationships

| Parent Table      | Parent Key | Child Table              | Child Key             | Cardinality |
| ----------------- | ---------- | ------------------------ | --------------------- | ----------- |
| cust_ledger_entry | entry*no*  | detailed_cust_ledg_entry | cust*ledger_entry_no* | 1:N         |
| item_ledger_entry | entry*no*  | item_application_entry   | item*ledger_entry_no* | 1:N         |
| g_l_account       | no\_       | g_l_entry                | g*l_account_no*       | 1:N         |

### Dimension Relationships

| Parent Table        | Parent Key           | Child Table         | Child Key                            | Cardinality |
| ------------------- | -------------------- | ------------------- | ------------------------------------ | ----------- |
| dimension_value     | dimension_code, code | dimension_set_entry | dimension_code, dimension_value_code | 1:N         |
| dimension_set_entry | dimension_set_id     | g_l_entry           | dimension_set_id                     | 1:N         |
| dimension_set_entry | dimension_set_id     | item_ledger_entry   | dimension_set_id                     | 1:N         |

### Self-Referencing Relationships

| Table    | Column               | Purpose                         |
| -------- | -------------------- | ------------------------------- |
| employee | manager*no*          | Employee reporting hierarchy    |
| customer | bill*to_customer_no* | Bill-to customer relationship   |
| item     | alternative*item_no* | Item substitution               |
| item     | repack*item_no*      | Repack relationship             |
| item     | lb*item_no*          | Pound-unit item conversion      |
| item     | master*item_no*      | Master item grouping            |
| bin      | linked_to_drop_bin   | Bin linking for drop operations |

---

## Table Specifications

### acc_schedule_line

**Original NAV Table:** `Acc_ Schedule Line`  
**Columns:** 24  
**Primary Key:** `(source_db, schedule_name, line_no_)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `schedule_name`        | `text`          | ✓   | nvarchar(10)    |
| 4   | `line_no_`             | `integer`       | ✓   | int             |
| 5   | `row_no_`              | `text`          |     | nvarchar(10)    |
| 6   | `description`          | `text`          |     | nvarchar(80)    |
| 7   | `totaling`             | `text`          |     | nvarchar(250)   |
| 8   | `totaling_type`        | `integer`       |     | int             |
| 9   | `new_page`             | `boolean`       |     | tinyint         |
| 10  | `indentation`          | `integer`       |     | int             |
| 11  | `show`                 | `integer`       |     | int             |
| 12  | `dimension_1_totaling` | `text`          |     | nvarchar(250)   |
| 13  | `dimension_2_totaling` | `text`          |     | nvarchar(250)   |
| 14  | `dimension_3_totaling` | `text`          |     | nvarchar(250)   |
| 15  | `dimension_4_totaling` | `text`          |     | nvarchar(250)   |
| 16  | `bold`                 | `boolean`       |     | tinyint         |
| 17  | `italic`               | `boolean`       |     | tinyint         |
| 18  | `underline`            | `boolean`       |     | tinyint         |
| 19  | `show_opposite_sign`   | `boolean`       |     | tinyint         |
| 20  | `row_type`             | `integer`       |     | int             |
| 21  | `amount_type`          | `integer`       |     | int             |
| 22  | `double_underline`     | `boolean`       |     | tinyint         |
| 23  | `cost_center_totaling` | `text`          |     | nvarchar(80)    |
| 24  | `cost_object_totaling` | `text`          |     | nvarchar(80)    |

### accounting_period

**Original NAV Table:** `Accounting Period`  
**Columns:** 9  
**Primary Key:** `(source_db, starting_date)`

| #   | Column Name              | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`              | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                   | `text`          |     | nvarchar(66)    |
| 3   | `starting_date`          | `timestamptz`   | ✓   | datetime        |
| 4   | `name`                   | `text`          |     | nvarchar(10)    |
| 5   | `new_fiscal_year`        | `boolean`       |     | tinyint         |
| 6   | `closed`                 | `boolean`       |     | tinyint         |
| 7   | `date_locked`            | `boolean`       |     | tinyint         |
| 8   | `average_cost_calc_type` | `integer`       |     | int             |
| 9   | `average_cost_period`    | `integer`       |     | int             |

### appointment_schedule

**Original NAV Table:** `Appointment Schedule`  
**Columns:** 9  
**Primary Key:** `(source_db, location_code, code, date, time)`

| #   | Column Name     | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------- | --------------- | --- | --------------- |
| 1   | `source_db`     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`          | `text`          |     | nvarchar(66)    |
| 3   | `location_code` | `text`          | ✓   | nvarchar(20)    |
| 4   | `code`          | `text`          | ✓   | nvarchar(20)    |
| 5   | `date`          | `timestamptz`   | ✓   | datetime        |
| 6   | `time`          | `timestamptz`   | ✓   | datetime        |
| 7   | `document_no_`  | `text`          |     | nvarchar(20)    |
| 8   | `vendor_name`   | `text`          |     | nvarchar(50)    |
| 9   | `user_id`       | `text`          |     | nvarchar(50)    |

### bank_account

**Original NAV Table:** `Bank Account`  
**Columns:** 10  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)    |
| 4   | `name`                    | `text`          |     | nvarchar(50)    |
| 5   | `search_name`             | `text`          |     | nvarchar(50)    |
| 6   | `name_2`                  | `text`          |     | nvarchar(50)    |
| 7   | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 8   | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |
| 9   | `bank_acc_posting_group`  | `text`          |     | nvarchar(20)    |
| 10  | `last_check_no_`          | `text`          |     | nvarchar(20)    |

### bid_header

**Original NAV Table:** `Bid Header`  
**Columns:** 10  
**Primary Key:** `(source_db, code)`

| #   | Column Name       | PostgreSQL Type | PK  | Original MS SQL |
| --- | ----------------- | --------------- | --- | --------------- |
| 1   | `source_db`       | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`            | `text`          |     | nvarchar(66)    |
| 3   | `code`            | `text`          | ✓   | nvarchar(20)    |
| 4   | `description`     | `text`          |     | nvarchar(50)    |
| 5   | `standard_markup` | `integer`       |     | int             |
| 6   | `bid_type`        | `integer`       |     | int             |
| 7   | `markup_cost`     | `integer`       |     | int             |
| 8   | `fixed_price`     | `boolean`       |     | tinyint         |
| 9   | `starting_date`   | `timestamptz`   |     | datetime        |
| 10  | `ending_date`     | `timestamptz`   |     | datetime        |

### bid_line

**Original NAV Table:** `Bid Line`  
**Columns:** 25  
**Primary Key:** `(source_db, code, item_type, item_code, starting_date, ending_date)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                          | `text`          |     | nvarchar(66)    |
| 3   | `code`                          | `text`          | ✓   | nvarchar(20)    |
| 4   | `item_type`                     | `integer`       | ✓   | int             |
| 5   | `item_code`                     | `text`          | ✓   | nvarchar(20)    |
| 6   | `starting_date`                 | `timestamptz`   | ✓   | datetime        |
| 7   | `ending_date`                   | `timestamptz`   | ✓   | datetime        |
| 8   | `standard_markup`               | `integer`       |     | int             |
| 9   | `bid_type`                      | `integer`       |     | int             |
| 10  | `markup_cost`                   | `integer`       |     | int             |
| 11  | `fixed_price`                   | `boolean`       |     | tinyint         |
| 12  | `markup_amount`                 | `decimal`       |     | decimal         |
| 13  | `current_price`                 | `decimal`       |     | decimal         |
| 14  | `future_price`                  | `decimal`       |     | decimal         |
| 15  | `actual_cost`                   | `decimal`       |     | decimal         |
| 16  | `allowance_per_case`            | `decimal`       |     | decimal         |
| 17  | `break_case_upcharge`           | `decimal`       |     | decimal         |
| 18  | `current_break_case_price`      | `decimal`       |     | decimal         |
| 19  | `future_break_case_price`       | `decimal`       |     | decimal         |
| 20  | `change_code`                   | `text`          |     | nvarchar(1)     |
| 21  | `cost_type`                     | `integer`       |     | int             |
| 22  | `sales_rep_cost_overide`        | `decimal`       |     | decimal         |
| 23  | `locked`                        | `boolean`       |     | tinyint         |
| 24  | `commodity_markup_amount`       | `decimal`       |     | decimal         |
| 25  | `commodity_break_case_upcharge` | `decimal`       |     | decimal         |

### bin

**Original NAV Table:** `Bin`  
**Columns:** 36  
**Primary Key:** `(source_db, location_code, code)`

| #   | Column Name                  | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                  | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                       | `text`          |     | nvarchar(66)    |
| 3   | `location_code`              | `text`          | ✓   | nvarchar(10)    |
| 4   | `code`                       | `text`          | ✓   | nvarchar(20)    |
| 5   | `description`                | `text`          |     | nvarchar(50)    |
| 6   | `zone_code`                  | `text`          |     | nvarchar(10)    |
| 7   | `bin_type_code`              | `text`          |     | nvarchar(10)    |
| 8   | `warehouse_class_code`       | `text`          |     | nvarchar(10)    |
| 9   | `block_movement`             | `integer`       |     | int             |
| 10  | `special_equipment_code`     | `text`          |     | nvarchar(10)    |
| 11  | `bin_ranking`                | `integer`       |     | int             |
| 12  | `maximum_cubage`             | `decimal`       |     | decimal         |
| 13  | `maximum_weight`             | `decimal`       |     | decimal         |
| 14  | `empty`                      | `boolean`       |     | tinyint         |
| 15  | `cross_dock_bin`             | `smallint`      |     | tinyint         |
| 16  | `dedicated`                  | `boolean`       |     | tinyint         |
| 17  | `aisle`                      | `integer`       |     | int             |
| 18  | `side`                       | `integer`       |     | int             |
| 19  | `position`                   | `integer`       |     | int             |
| 20  | `level`                      | `integer`       |     | int             |
| 21  | `distance`                   | `integer`       |     | int             |
| 22  | `bin_size`                   | `decimal`       |     | decimal         |
| 23  | `bin_height`                 | `decimal`       |     | decimal         |
| 24  | `dummy_bin`                  | `smallint`      |     | tinyint         |
| 25  | `wave_pick_bin`              | `boolean`       |     | tinyint         |
| 26  | `bin_sorting`                | `integer`       |     | int             |
| 27  | `pallet_bin`                 | `smallint`      |     | tinyint         |
| 28  | `pallet_counting_period`     | `text`          |     | nvarchar(10)    |
| 29  | `last_counted_date`          | `timestamptz`   |     | datetime        |
| 30  | `pallet_count_ranking`       | `integer`       |     | int             |
| 31  | `included_in_quick_count`    | `boolean`       |     | tinyint         |
| 32  | `drop_bin`                   | `smallint`      |     | tinyint         |
| 33  | `linked_to_drop_bin`         | `text`          |     | nvarchar(20)    |
| 34  | `last_counted_datetime`      | `timestamptz`   |     | datetime        |
| 35  | `default_replenishment_rule` | `text`          |     | nvarchar(10)    |
| 36  | `pallet_type`                | `text`          |     | nvarchar(20)    |

### bin_content

**Original NAV Table:** `Bin Content`  
**Columns:** 24  
**Primary Key:** `(source_db, location_code, bin_code, item_no_, variant_code, unit_of_measure_code)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `location_code`           | `text`          | ✓   | nvarchar(10)    |
| 4   | `bin_code`                | `text`          | ✓   | nvarchar(20)    |
| 5   | `item_no_`                | `text`          | ✓   | nvarchar(20)    |
| 6   | `variant_code`            | `text`          | ✓   | nvarchar(10)    |
| 7   | `unit_of_measure_code`    | `text`          | ✓   | nvarchar(10)    |
| 8   | `zone_code`               | `text`          |     | nvarchar(10)    |
| 9   | `bin_type_code`           | `text`          |     | nvarchar(10)    |
| 10  | `warehouse_class_code`    | `text`          |     | nvarchar(10)    |
| 11  | `block_movement`          | `integer`       |     | int             |
| 12  | `min_qty`                 | `decimal`       |     | decimal         |
| 13  | `max_qty`                 | `decimal`       |     | decimal         |
| 14  | `bin_ranking`             | `integer`       |     | int             |
| 15  | `fixed`                   | `boolean`       |     | tinyint         |
| 16  | `cross_dock_bin`          | `smallint`      |     | tinyint         |
| 17  | `default`                 | `boolean`       |     | tinyint         |
| 18  | `qty_per_unit_of_measure` | `decimal`       |     | decimal         |
| 19  | `dedicated`               | `boolean`       |     | tinyint         |
| 20  | `replen_user`             | `text`          |     | nvarchar(50)    |
| 21  | `source_no_`              | `text`          |     | nvarchar(20)    |
| 22  | `bin_sorting`             | `integer`       |     | int             |
| 23  | `license_plate_ranking`   | `integer`       |     | int             |
| 24  | `replenishment_rule`      | `text`          |     | nvarchar(10)    |

### bin_type

**Original NAV Table:** `Bin Type`  
**Columns:** 10  
**Primary Key:** `(source_db, code)`

| #   | Column Name     | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------- | --------------- | --- | --------------- |
| 1   | `source_db`     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`          | `text`          |     | nvarchar(66)    |
| 3   | `code`          | `text`          | ✓   | nvarchar(10)    |
| 4   | `description`   | `text`          |     | nvarchar(50)    |
| 5   | `receive`       | `boolean`       |     | tinyint         |
| 6   | `ship`          | `boolean`       |     | tinyint         |
| 7   | `put_away`      | `boolean`       |     | tinyint         |
| 8   | `pick`          | `boolean`       |     | tinyint         |
| 9   | `pallet_pick`   | `boolean`       |     | tinyint         |
| 10  | `special_order` | `smallint`      |     | tinyint         |

### campaign

**Original NAV Table:** `Campaign`  
**Columns:** 14  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)    |
| 4   | `description`             | `text`          |     | nvarchar(50)    |
| 5   | `starting_date`           | `timestamptz`   |     | datetime        |
| 6   | `ending_date`             | `timestamptz`   |     | datetime        |
| 7   | `salesperson_code`        | `text`          |     | nvarchar(20)    |
| 8   | `last_date_modified`      | `timestamptz`   |     | datetime        |
| 9   | `no_series`               | `text`          |     | nvarchar(20)    |
| 10  | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 11  | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |
| 12  | `status_code`             | `text`          |     | nvarchar(10)    |
| 13  | `price_sequence`          | `integer`       |     | int             |
| 14  | `location_code`           | `text`          |     | nvarchar(10)    |

### campaign_target_group

**Original NAV Table:** `Campaign Target Group`  
**Columns:** 6  
**Primary Key:** `(source_db, type, no_, campaign_no_)`

| #   | Column Name      | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------- | --------------- | --- | --------------- |
| 1   | `source_db`      | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`           | `text`          |     | nvarchar(66)    |
| 3   | `type`           | `integer`       | ✓   | int             |
| 4   | `no_`            | `text`          | ✓   | nvarchar(20)    |
| 5   | `campaign_no_`   | `text`          | ✓   | nvarchar(20)    |
| 6   | `price_sequence` | `integer`       |     | int             |

### change_log_entry

**Original NAV Table:** `Change Log Entry`  
**Columns:** 16  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                 | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                 | `text`          | ✓   | nvarchar(20)    |
| 2   | `entry_no_`                 | `bigint`        | ✓   | bigint          |
| 3   | `date_and_time`             | `timestamptz`   |     | datetime        |
| 4   | `time`                      | `timestamptz`   |     | datetime        |
| 5   | `user_id`                   | `text`          |     | nvarchar(50)    |
| 6   | `table_no_`                 | `integer`       |     | int             |
| 7   | `field_no_`                 | `integer`       |     | int             |
| 8   | `type_of_change`            | `integer`       |     | int             |
| 9   | `old_value`                 | `text`          |     | nvarchar(250)   |
| 10  | `new_value`                 | `text`          |     | nvarchar(250)   |
| 11  | `primary_key_field_1_no_`   | `integer`       |     | int             |
| 12  | `primary_key_field_1_value` | `text`          |     | nvarchar(50)    |
| 13  | `primary_key_field_2_no_`   | `integer`       |     | int             |
| 14  | `primary_key_field_2_value` | `text`          |     | nvarchar(50)    |
| 15  | `primary_key_field_3_no_`   | `integer`       |     | int             |
| 16  | `primary_key_field_3_value` | `text`          |     | nvarchar(50)    |

### change_log_entry_full_history

**Original NAV Table:** `Change Log Entry (Full History)`  
**Columns:** 16  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                 | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                 | `text`          | ✓   | nvarchar(20)    |
| 2   | `entry_no_`                 | `bigint`        | ✓   | bigint          |
| 3   | `date_and_time`             | `timestamptz`   |     | datetime        |
| 4   | `time`                      | `timestamptz`   |     | datetime        |
| 5   | `user_id`                   | `text`          |     | nvarchar(50)    |
| 6   | `table_no_`                 | `integer`       |     | int             |
| 7   | `field_no_`                 | `integer`       |     | int             |
| 8   | `type_of_change`            | `integer`       |     | int             |
| 9   | `old_value`                 | `text`          |     | nvarchar(250)   |
| 10  | `new_value`                 | `text`          |     | nvarchar(250)   |
| 11  | `primary_key_field_1_no_`   | `integer`       |     | int             |
| 12  | `primary_key_field_1_value` | `text`          |     | nvarchar(50)    |
| 13  | `primary_key_field_2_no_`   | `integer`       |     | int             |
| 14  | `primary_key_field_2_value` | `text`          |     | nvarchar(50)    |
| 15  | `primary_key_field_3_no_`   | `integer`       |     | int             |
| 16  | `primary_key_field_3_value` | `text`          |     | nvarchar(50)    |

### co_op_distributor_transaction

**Original NAV Table:** `Co-op Distributor Transaction`  
**Columns:** 27  
**Primary Key:** `(source_db, manufacturer_code, recipient_agency_no_, document_no_, document_line_no_, manufacture_item_no_, document_type)`

| #   | Column Name                  | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                  | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                       | `text`          |     | nvarchar(66)    |
| 3   | `manufacturer_code`          | `text`          | ✓   | nvarchar(6)     |
| 4   | `recipient_agency_no_`       | `text`          | ✓   | nvarchar(12)    |
| 5   | `document_no_`               | `text`          | ✓   | nvarchar(20)    |
| 6   | `document_line_no_`          | `text`          | ✓   | nvarchar(20)    |
| 7   | `manufacture_item_no_`       | `text`          | ✓   | nvarchar(20)    |
| 8   | `document_type`              | `text`          | ✓   | nvarchar(3)     |
| 9   | `reported_by`                | `text`          |     | nvarchar(15)    |
| 10  | `document_date`              | `timestamptz`   |     | datetime        |
| 11  | `quantity`                   | `decimal`       |     | decimal         |
| 12  | `distributor_name`           | `text`          |     | nvarchar(50)    |
| 13  | `bill_to_customer_no_`       | `text`          |     | nvarchar(12)    |
| 14  | `nav_vendor_no_`             | `text`          |     | nvarchar(20)    |
| 15  | `nav_item_no_`               | `text`          |     | nvarchar(20)    |
| 16  | `line_import_error`          | `boolean`       |     | tinyint         |
| 17  | `error_message`              | `text`          |     | nvarchar(250)   |
| 18  | `date_imported`              | `timestamptz`   |     | datetime        |
| 19  | `time_imported`              | `timestamptz`   |     | datetime        |
| 20  | `imported_by`                | `text`          |     | nvarchar(50)    |
| 21  | `date_processed`             | `timestamptz`   |     | datetime        |
| 22  | `time_processed`             | `timestamptz`   |     | datetime        |
| 23  | `posted_by`                  | `text`          |     | nvarchar(50)    |
| 24  | `import_filename`            | `text`          |     | nvarchar(250)   |
| 25  | `distributor_name_modified`  | `text`          |     | nvarchar(50)    |
| 26  | `commodity_ledger_entry_no_` | `integer`       |     | int             |
| 27  | `entry_no_`                  | `integer`       |     | int             |

### commodity_amt_limit

**Original NAV Table:** `Commodity AMT Limit`  
**Columns:** 3  
**Primary Key:** `(source_db, co_op_district_amt_code)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `co_op_district_amt_code` | `text`          | ✓   | nvarchar(20)    |

### commodity_component

**Original NAV Table:** `Commodity Component`  
**Columns:** 9  
**Primary Key:** `(source_db, parent_item_no_, vendor_no_, line_no_, unit_of_measure_code)`

| #   | Column Name              | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`              | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                   | `text`          |     | nvarchar(66)    |
| 3   | `parent_item_no_`        | `text`          | ✓   | nvarchar(40)    |
| 4   | `vendor_no_`             | `text`          | ✓   | nvarchar(20)    |
| 5   | `line_no_`               | `integer`       | ✓   | int             |
| 6   | `item_no_`               | `text`          |     | nvarchar(20)    |
| 7   | `unit_of_measure_code`   | `text`          | ✓   | nvarchar(10)    |
| 8   | `yield`                  | `decimal`       |     | decimal         |
| 9   | `net_off_invoice_amount` | `decimal`       |     | decimal         |

### commodity_lb_limit

**Original NAV Table:** `Commodity LB Limit`  
**Columns:** 5  
**Primary Key:** `(source_db, co_op_district_quantity_code, vendor_group_code, item_no_)`

| #   | Column Name                    | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`                    | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                         | `text`          |     | nvarchar(66)    |
| 3   | `co_op_district_quantity_code` | `text`          | ✓   | nvarchar(20)    |
| 4   | `vendor_group_code`            | `text`          | ✓   | nvarchar(20)    |
| 5   | `item_no_`                     | `text`          | ✓   | nvarchar(20)    |

### commodity_ledger_entry

**Original NAV Table:** `Commodity Ledger Entry`  
**Columns:** 29  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                    | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`                    | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                         | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                    | `integer`       | ✓   | int             |
| 4   | `item_no_`                     | `text`          |     | nvarchar(40)    |
| 5   | `posting_date`                 | `timestamptz`   |     | datetime        |
| 6   | `entry_type`                   | `integer`       |     | int             |
| 7   | `document_no_`                 | `text`          |     | nvarchar(20)    |
| 8   | `vendor_group_code`            | `text`          |     | nvarchar(20)    |
| 9   | `document_type`                | `integer`       |     | int             |
| 10  | `document_line_no_`            | `integer`       |     | int             |
| 11  | `item_ledger_entry_no_`        | `integer`       |     | int             |
| 12  | `true_posting_date_time`       | `timestamptz`   |     | datetime        |
| 13  | `quantity`                     | `decimal`       |     | decimal         |
| 14  | `bill_to_customer_no_`         | `text`          |     | nvarchar(20)    |
| 15  | `distributor_name`             | `text`          |     | nvarchar(50)    |
| 16  | `distributor_sub_name`         | `text`          |     | nvarchar(50)    |
| 17  | `co_op_district_quantity_code` | `text`          |     | nvarchar(20)    |
| 18  | `amount`                       | `decimal`       |     | decimal         |
| 19  | `fair_market_value`            | `decimal`       |     | decimal         |
| 20  | `unit_of_measure_code`         | `text`          |     | nvarchar(10)    |
| 21  | `reason_code`                  | `text`          |     | nvarchar(10)    |
| 22  | `gsf_item`                     | `boolean`       |     | tinyint         |
| 23  | `finished_good`                | `boolean`       |     | tinyint         |
| 24  | `reported_by`                  | `text`          |     | nvarchar(30)    |
| 25  | `co_op_district_amount_code`   | `text`          |     | nvarchar(20)    |
| 26  | `entitlement_type`             | `text`          |     | nvarchar(20)    |
| 27  | `outside_sale`                 | `boolean`       |     | tinyint         |
| 28  | `state_code`                   | `text`          |     | nvarchar(10)    |
| 29  | `commodity_region`             | `text`          |     | nvarchar(20)    |

### commodity_opt_out

**Original NAV Table:** `Commodity Opt Out`  
**Columns:** 6  
**Primary Key:** `(source_db, co_op_district_group_code, vendor_group_code, item_no_)`

| #   | Column Name                 | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                 | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                      | `text`          |     | nvarchar(66)    |
| 3   | `co_op_district_group_code` | `text`          | ✓   | nvarchar(20)    |
| 4   | `vendor_group_code`         | `text`          | ✓   | nvarchar(20)    |
| 5   | `item_no_`                  | `text`          | ✓   | nvarchar(20)    |
| 6   | `type`                      | `integer`       |     | int             |

### contact

**Original NAV Table:** `Contact`  
**Columns:** 30  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                 | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                 | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                      | `text`          |     | nvarchar(66)    |
| 3   | `no_`                       | `text`          | ✓   | nvarchar(20)    |
| 4   | `name`                      | `text`          |     | nvarchar(50)    |
| 5   | `search_name`               | `text`          |     | nvarchar(50)    |
| 6   | `name_2`                    | `text`          |     | nvarchar(50)    |
| 7   | `address`                   | `text`          |     | nvarchar(50)    |
| 8   | `address_2`                 | `text`          |     | nvarchar(50)    |
| 9   | `city`                      | `text`          |     | nvarchar(30)    |
| 10  | `phone_no_`                 | `text`          |     | nvarchar(30)    |
| 11  | `salesperson_code`          | `text`          |     | nvarchar(20)    |
| 12  | `fax_no_`                   | `text`          |     | nvarchar(30)    |
| 13  | `post_code`                 | `text`          |     | nvarchar(20)    |
| 14  | `county`                    | `text`          |     | nvarchar(30)    |
| 15  | `e_mail`                    | `text`          |     | nvarchar(80)    |
| 16  | `home_page`                 | `text`          |     | nvarchar(80)    |
| 17  | `no_series`                 | `text`          |     | nvarchar(20)    |
| 18  | `type`                      | `integer`       |     | int             |
| 19  | `company_no_`               | `text`          |     | nvarchar(20)    |
| 20  | `company_name`              | `text`          |     | nvarchar(50)    |
| 21  | `first_name`                | `text`          |     | nvarchar(30)    |
| 22  | `middle_name`               | `text`          |     | nvarchar(30)    |
| 23  | `surname`                   | `text`          |     | nvarchar(30)    |
| 24  | `job_title`                 | `text`          |     | nvarchar(30)    |
| 25  | `mobile_phone_no_`          | `text`          |     | nvarchar(30)    |
| 26  | `pager`                     | `text`          |     | nvarchar(30)    |
| 27  | `organizational_level_code` | `text`          |     | nvarchar(10)    |
| 28  | `exclude_from_segment`      | `boolean`       |     | tinyint         |
| 29  | `search_e_mail`             | `text`          |     | nvarchar(80)    |
| 30  | `e_mail_2`                  | `text`          |     | nvarchar(80)    |

### contact_business_relation

**Original NAV Table:** `Contact Business Relation`  
**Columns:** 6  
**Primary Key:** `(source_db, contact_no_, business_relation_code)`

| #   | Column Name              | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`              | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                   | `text`          |     | nvarchar(66)    |
| 3   | `contact_no_`            | `text`          | ✓   | nvarchar(20)    |
| 4   | `business_relation_code` | `text`          | ✓   | nvarchar(10)    |
| 5   | `link_to_table`          | `integer`       |     | int             |
| 6   | `no_`                    | `text`          |     | nvarchar(20)    |

### cust_ledger_entry

**Original NAV Table:** `Cust_ Ledger Entry`  
**Columns:** 44  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                   | PostgreSQL Type | PK  | Original MS SQL |
| --- | ----------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                   | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                        | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                   | `integer`       | ✓   | int             |
| 4   | `customer_no_`                | `text`          |     | nvarchar(20)    |
| 5   | `posting_date`                | `timestamptz`   |     | datetime        |
| 6   | `document_type`               | `integer`       |     | int             |
| 7   | `document_no_`                | `text`          |     | nvarchar(20)    |
| 8   | `description`                 | `text`          |     | nvarchar(50)    |
| 9   | `sales_lcy`                   | `decimal`       |     | decimal         |
| 10  | `profit_lcy`                  | `decimal`       |     | decimal         |
| 11  | `inv_discount_lcy`            | `decimal`       |     | decimal         |
| 12  | `sell_to_customer_no_`        | `text`          |     | nvarchar(20)    |
| 13  | `customer_posting_group`      | `text`          |     | nvarchar(20)    |
| 14  | `global_dimension_1_code`     | `text`          |     | nvarchar(20)    |
| 15  | `global_dimension_2_code`     | `text`          |     | nvarchar(20)    |
| 16  | `salesperson_code`            | `text`          |     | nvarchar(20)    |
| 17  | `user_id`                     | `text`          |     | nvarchar(50)    |
| 18  | `source_code`                 | `text`          |     | nvarchar(10)    |
| 19  | `open`                        | `boolean`       |     | tinyint         |
| 20  | `due_date`                    | `timestamptz`   |     | datetime        |
| 21  | `pmt_discount_date`           | `timestamptz`   |     | datetime        |
| 22  | `original_pmt_disc_possible`  | `decimal`       |     | decimal         |
| 23  | `pmt_disc_given_lcy`          | `decimal`       |     | decimal         |
| 24  | `positive`                    | `boolean`       |     | tinyint         |
| 25  | `closed_by_entry_no_`         | `integer`       |     | int             |
| 26  | `closed_at_date`              | `timestamptz`   |     | datetime        |
| 27  | `closed_by_amount`            | `decimal`       |     | decimal         |
| 28  | `applies_to_id`               | `text`          |     | nvarchar(50)    |
| 29  | `journal_batch_name`          | `text`          |     | nvarchar(10)    |
| 30  | `reason_code`                 | `text`          |     | nvarchar(10)    |
| 31  | `bal_account_type`            | `integer`       |     | int             |
| 32  | `bal_account_no_`             | `text`          |     | nvarchar(20)    |
| 33  | `transaction_no_`             | `integer`       |     | int             |
| 34  | `closed_by_amount_lcy`        | `decimal`       |     | decimal         |
| 35  | `document_date`               | `timestamptz`   |     | datetime        |
| 36  | `external_document_no_`       | `text`          |     | nvarchar(35)    |
| 37  | `no_series`                   | `text`          |     | nvarchar(20)    |
| 38  | `closed_by_currency_amount`   | `decimal`       |     | decimal         |
| 39  | `adjusted_currency_factor`    | `decimal`       |     | decimal         |
| 40  | `original_currency_factor`    | `decimal`       |     | decimal         |
| 41  | `remaining_pmt_disc_possible` | `decimal`       |     | decimal         |
| 42  | `pmt_disc_tolerance_date`     | `timestamptz`   |     | datetime        |
| 43  | `dimension_set_id`            | `integer`       |     | int             |
| 44  | `order_type`                  | `text`          |     | nvarchar(20)    |

### customer

**Original NAV Table:** `Customer`  
**Columns:** 82  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL  |
| --- | ------------------------------- | --------------- | --- | ---------------- |
| 1   | `source_db`                     | `text`          | ✓   | nvarchar(20)     |
| 2   | `hash`                          | `text`          |     | nvarchar(66)     |
| 3   | `no_`                           | `text`          | ✓   | nvarchar(20)     |
| 4   | `name`                          | `text`          |     | nvarchar(50)     |
| 5   | `name_2`                        | `text`          |     | nvarchar(50)     |
| 6   | `address`                       | `text`          |     | nvarchar(50)     |
| 7   | `address_2`                     | `text`          |     | nvarchar(50)     |
| 8   | `city`                          | `text`          |     | nvarchar(30)     |
| 9   | `contact`                       | `text`          |     | nvarchar(50)     |
| 10  | `phone_no_`                     | `text`          |     | nvarchar(30)     |
| 11  | `global_dimension_1_code`       | `text`          |     | nvarchar(20)     |
| 12  | `global_dimension_2_code`       | `text`          |     | nvarchar(20)     |
| 13  | `customer_posting_group`        | `text`          |     | nvarchar(20)     |
| 14  | `payment_terms_code`            | `text`          |     | nvarchar(10)     |
| 15  | `salesperson_code`              | `text`          |     | nvarchar(20)     |
| 16  | `shipment_method_code`          | `text`          |     | nvarchar(10)     |
| 17  | `invoice_disc_code`             | `text`          |     | nvarchar(20)     |
| 18  | `customer_disc_group`           | `text`          |     | nvarchar(20)     |
| 19  | `country_region_code`           | `text`          |     | nvarchar(10)     |
| 20  | `print_statements`              | `boolean`       |     | tinyint          |
| 21  | `bill_to_customer_no_`          | `text`          |     | nvarchar(20)     |
| 22  | `payment_method_code`           | `text`          |     | nvarchar(10)     |
| 23  | `location_code`                 | `text`          |     | nvarchar(10)     |
| 24  | `combine_shipments`             | `boolean`       |     | tinyint          |
| 25  | `gen_bus_posting_group`         | `text`          |     | nvarchar(20)     |
| 26  | `post_code`                     | `text`          |     | nvarchar(20)     |
| 27  | `county`                        | `text`          |     | nvarchar(30)     |
| 28  | `e_mail`                        | `text`          |     | nvarchar(80)     |
| 29  | `tax_area_code`                 | `text`          |     | nvarchar(20)     |
| 30  | `tax_liable`                    | `boolean`       |     | tinyint          |
| 31  | `reserve`                       | `integer`       |     | int              |
| 32  | `primary_contact_no_`           | `text`          |     | nvarchar(20)     |
| 33  | `allow_line_disc`               | `boolean`       |     | tinyint          |
| 34  | `tax_area_id`                   | `uuid`          |     | uniqueidentifier |
| 35  | `csr`                           | `text`          |     | nvarchar(20)     |
| 36  | `district_group_code`           | `text`          |     | nvarchar(10)     |
| 37  | `price_orders_at_shipment`      | `boolean`       |     | tinyint          |
| 38  | `geographic_code`               | `text`          |     | nvarchar(20)     |
| 39  | `sodexo_unit_no_`               | `text`          |     | nvarchar(20)     |
| 40  | `ra_no_`                        | `text`          |     | nvarchar(20)     |
| 41  | `hours_of_operation`            | `text`          |     | nvarchar(20)     |
| 42  | `bill_to_primary_contact_no_`   | `text`          |     | nvarchar(20)     |
| 43  | `default_external_document_no_` | `text`          |     | nvarchar(20)     |
| 44  | `dod_usda_customer_no_`         | `text`          |     | nvarchar(10)     |
| 45  | `allow_zero_qty_lines`          | `boolean`       |     | tinyint          |
| 46  | `combine_bread_broadline`       | `boolean`       |     | tinyint          |
| 47  | `online_customer`               | `boolean`       |     | tinyint          |
| 48  | `pricing_uses_order_date`       | `smallint`      |     | tinyint          |
| 49  | `charge_storage_fees`           | `smallint`      |     | tinyint          |
| 50  | `rebate_invoices`               | `boolean`       |     | tinyint          |
| 51  | `ups_location_code`             | `text`          |     | nvarchar(20)     |
| 52  | `exclude_from_crv`              | `boolean`       |     | tinyint          |
| 53  | `use_invoice_with_zones`        | `boolean`       |     | tinyint          |
| 54  | `special_instructions`          | `text`          |     | nvarchar(50)     |
| 55  | `bill_to_customer`              | `smallint`      |     | tinyint          |
| 56  | `customer_accepts_subs`         | `smallint`      |     | tinyint          |
| 57  | `keys_to_gate`                  | `smallint`      |     | tinyint          |
| 58  | `keys_to_kitchen`               | `smallint`      |     | tinyint          |
| 59  | `keys_to_walk_in`               | `smallint`      |     | tinyint          |
| 60  | `co_op_code`                    | `text`          |     | nvarchar(10)     |
| 61  | `5_star_exception`              | `smallint`      |     | tinyint          |
| 62  | `do_not_combine`                | `boolean`       |     | tinyint          |
| 63  | `do_not_break_item`             | `smallint`      |     | tinyint          |
| 64  | `tls`                           | `integer`       |     | int              |
| 65  | `order_type`                    | `text`          |     | nvarchar(20)     |
| 66  | `njpa_code`                     | `integer`       |     | int              |
| 67  | `customer_drop_type`            | `text`          |     | nvarchar(20)     |
| 68  | `pallet_per_item`               | `smallint`      |     | tinyint          |
| 69  | `audit_picks`                   | `boolean`       |     | tinyint          |
| 70  | `edi_invoice`                   | `integer`       |     | int              |
| 71  | `edi_trade_partner`             | `text`          |     | nvarchar(20)     |
| 72  | `dod_customer`                  | `boolean`       |     | tinyint          |
| 73  | `chain_name`                    | `text`          |     | nvarchar(10)     |
| 74  | `priority`                      | `integer`       |     | int              |
| 75  | `legacy_no_`                    | `text`          |     | nvarchar(20)     |
| 76  | `sync_filter`                   | `text`          |     | nvarchar(20)     |
| 77  | `credit_limit_lcy`              | `decimal`       |     | decimal          |
| 78  | `type`                          | `text`          |     | nvarchar(20)     |
| 79  | `group`                         | `text`          |     | nvarchar(20)     |
| 80  | `status`                        | `text`          |     | nvarchar(20)     |
| 81  | `account_type`                  | `text`          |     | nvarchar(20)     |
| 82  | `commodity_region`              | `text`          |     | nvarchar(20)     |

### customer_grouping

**Original NAV Table:** `Customer Grouping`  
**Columns:** 8  
**Primary Key:** `(source_db, type, code, customer_type, customer_code)`

| #   | Column Name     | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------- | --------------- | --- | --------------- |
| 1   | `source_db`     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`          | `text`          |     | nvarchar(66)    |
| 3   | `type`          | `text`          | ✓   | nvarchar(10)    |
| 4   | `code`          | `text`          | ✓   | nvarchar(20)    |
| 5   | `customer_type` | `integer`       | ✓   | int             |
| 6   | `customer_code` | `text`          | ✓   | nvarchar(20)    |
| 7   | `priority`      | `integer`       |     | int             |
| 8   | `exclude`       | `boolean`       |     | tinyint         |

### default_dimension

**Original NAV Table:** `Default Dimension`  
**Columns:** 8  
**Primary Key:** `(source_db, table_id, no_, dimension_code)`

| #   | Column Name              | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`              | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                   | `text`          |     | nvarchar(66)    |
| 3   | `table_id`               | `integer`       | ✓   | int             |
| 4   | `no_`                    | `text`          | ✓   | nvarchar(20)    |
| 5   | `dimension_code`         | `text`          | ✓   | nvarchar(20)    |
| 6   | `dimension_value_code`   | `text`          |     | nvarchar(20)    |
| 7   | `value_posting`          | `integer`       |     | int             |
| 8   | `multi_selection_action` | `integer`       |     | int             |

### delivery_schedule

**Original NAV Table:** `Delivery Schedule`  
**Columns:** 21  
**Primary Key:** `(source_db, type, source_no_, order_type)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `type`                 | `integer`       | ✓   | int             |
| 4   | `source_no_`           | `text`          | ✓   | nvarchar(20)    |
| 5   | `order_type`           | `text`          | ✓   | nvarchar(20)    |
| 6   | `monday`               | `boolean`       |     | tinyint         |
| 7   | `tuesday`              | `boolean`       |     | tinyint         |
| 8   | `wednesday`            | `boolean`       |     | tinyint         |
| 9   | `thursday`             | `boolean`       |     | tinyint         |
| 10  | `friday`               | `boolean`       |     | tinyint         |
| 11  | `saturday`             | `boolean`       |     | tinyint         |
| 12  | `sunday`               | `boolean`       |     | tinyint         |
| 13  | `minimum_order_amount` | `decimal`       |     | decimal         |
| 14  | `lead_time`            | `integer`       |     | int             |
| 15  | `back_date_in_days`    | `integer`       |     | int             |
| 16  | `csr`                  | `text`          |     | nvarchar(20)    |
| 17  | `first_week`           | `boolean`       |     | tinyint         |
| 18  | `second_week`          | `boolean`       |     | tinyint         |
| 19  | `third_week`           | `boolean`       |     | tinyint         |
| 20  | `fourth_week`          | `boolean`       |     | tinyint         |
| 21  | `last_week`            | `boolean`       |     | tinyint         |

### detailed_cust_ledg_entry

**Original NAV Table:** `Detailed Cust_ Ledg_ Entry`  
**Columns:** 32  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                          | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                     | `integer`       | ✓   | int             |
| 4   | `cust_ledger_entry_no_`         | `integer`       |     | int             |
| 5   | `entry_type`                    | `integer`       |     | int             |
| 6   | `posting_date`                  | `timestamptz`   |     | datetime        |
| 7   | `document_type`                 | `integer`       |     | int             |
| 8   | `document_no_`                  | `text`          |     | nvarchar(20)    |
| 9   | `amount`                        | `decimal`       |     | decimal         |
| 10  | `amount_lcy`                    | `decimal`       |     | decimal         |
| 11  | `customer_no_`                  | `text`          |     | nvarchar(20)    |
| 12  | `user_id`                       | `text`          |     | nvarchar(50)    |
| 13  | `source_code`                   | `text`          |     | nvarchar(10)    |
| 14  | `transaction_no_`               | `integer`       |     | int             |
| 15  | `journal_batch_name`            | `text`          |     | nvarchar(10)    |
| 16  | `reason_code`                   | `text`          |     | nvarchar(10)    |
| 17  | `debit_amount`                  | `decimal`       |     | decimal         |
| 18  | `credit_amount`                 | `decimal`       |     | decimal         |
| 19  | `debit_amount_lcy`              | `decimal`       |     | decimal         |
| 20  | `credit_amount_lcy`             | `decimal`       |     | decimal         |
| 21  | `initial_entry_due_date`        | `timestamptz`   |     | datetime        |
| 22  | `initial_entry_global_dim_1`    | `text`          |     | nvarchar(20)    |
| 23  | `initial_entry_global_dim_2`    | `text`          |     | nvarchar(20)    |
| 24  | `gen_bus_posting_group`         | `text`          |     | nvarchar(20)    |
| 25  | `gen_prod_posting_group`        | `text`          |     | nvarchar(20)    |
| 26  | `initial_document_type`         | `integer`       |     | int             |
| 27  | `applied_cust_ledger_entry_no_` | `integer`       |     | int             |
| 28  | `unapplied`                     | `boolean`       |     | tinyint         |
| 29  | `unapplied_by_entry_no_`        | `integer`       |     | int             |
| 30  | `remaining_pmt_disc_possible`   | `decimal`       |     | decimal         |
| 31  | `max_payment_tolerance`         | `decimal`       |     | decimal         |
| 32  | `ledger_entry_amount`           | `boolean`       |     | tinyint         |

### detailed_vendor_ledg_entry

**Original NAV Table:** `Detailed Vendor Ledg_ Entry`  
**Columns:** 34  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                     | `text`          | ✓   | varchar(10)     |
| 2   | `hash`                          | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                     | `integer`       | ✓   | int             |
| 4   | `vendor_ledger_entry_no_`       | `integer`       |     | int             |
| 5   | `entry_type`                    | `integer`       |     | int             |
| 6   | `posting_date`                  | `timestamptz`   |     | datetime        |
| 7   | `document_type`                 | `integer`       |     | int             |
| 8   | `document_no_`                  | `text`          |     | nvarchar(20)    |
| 9   | `amount`                        | `decimal`       |     | decimal         |
| 10  | `amount_lcy`                    | `decimal`       |     | decimal         |
| 11  | `vendor_no_`                    | `text`          |     | nvarchar(20)    |
| 12  | `user_id`                       | `text`          |     | nvarchar(50)    |
| 13  | `source_code`                   | `text`          |     | nvarchar(10)    |
| 14  | `transaction_no_`               | `integer`       |     | int             |
| 15  | `journal_batch_name`            | `text`          |     | nvarchar(10)    |
| 16  | `reason_code`                   | `text`          |     | nvarchar(10)    |
| 17  | `debit_amount`                  | `decimal`       |     | decimal         |
| 18  | `credit_amount`                 | `decimal`       |     | decimal         |
| 19  | `debit_amount_lcy`              | `decimal`       |     | decimal         |
| 20  | `credit_amount_lcy`             | `decimal`       |     | decimal         |
| 21  | `initial_entry_due_date`        | `timestamptz`   |     | datetime        |
| 22  | `initial_entry_global_dim_1`    | `text`          |     | nvarchar(20)    |
| 23  | `initial_entry_global_dim_2`    | `text`          |     | nvarchar(20)    |
| 24  | `gen_bus_posting_group`         | `text`          |     | nvarchar(20)    |
| 25  | `gen_prod_posting_group`        | `text`          |     | nvarchar(20)    |
| 26  | `initial_document_type`         | `integer`       |     | int             |
| 27  | `applied_vend_ledger_entry_no_` | `integer`       |     | int             |
| 28  | `unapplied`                     | `boolean`       |     | tinyint         |
| 29  | `unapplied_by_entry_no_`        | `integer`       |     | int             |
| 30  | `remaining_pmt_disc_possible`   | `decimal`       |     | decimal         |
| 31  | `max_payment_tolerance`         | `decimal`       |     | decimal         |
| 32  | `tax_jurisdiction_code`         | `text`          |     | nvarchar(10)    |
| 33  | `application_no_`               | `integer`       |     | int             |
| 34  | `ledger_entry_amount`           | `boolean`       |     | tinyint         |

### dimension_set_entry

**Original NAV Table:** `Dimension Set Entry`  
**Columns:** 6  
**Primary Key:** `(source_db, dimension_set_id, dimension_code)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `dimension_set_id`     | `integer`       | ✓   | int             |
| 4   | `dimension_code`       | `text`          | ✓   | nvarchar(20)    |
| 5   | `dimension_value_code` | `text`          |     | nvarchar(20)    |
| 6   | `dimension_value_id`   | `integer`       |     | int             |

### dimension_value

**Original NAV Table:** `Dimension Value`  
**Columns:** 12  
**Primary Key:** `(source_db, dimension_code, code)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `dimension_code`       | `text`          | ✓   | nvarchar(20)    |
| 4   | `code`                 | `text`          | ✓   | nvarchar(20)    |
| 5   | `name`                 | `text`          |     | nvarchar(50)    |
| 6   | `dimension_value_type` | `integer`       |     | int             |
| 7   | `totaling`             | `text`          |     | nvarchar(250)   |
| 8   | `blocked`              | `boolean`       |     | tinyint         |
| 9   | `consolidation_code`   | `text`          |     | nvarchar(20)    |
| 10  | `indentation`          | `integer`       |     | int             |
| 11  | `global_dimension_no_` | `integer`       |     | int             |
| 12  | `dimension_value_id`   | `integer`       |     | int             |

### employee

**Original NAV Table:** `Employee`  
**Columns:** 12  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)    |
| 4   | `first_name`              | `text`          |     | nvarchar(30)    |
| 5   | `middle_name`             | `text`          |     | nvarchar(30)    |
| 6   | `last_name`               | `text`          |     | nvarchar(30)    |
| 7   | `initials`                | `text`          |     | nvarchar(30)    |
| 8   | `job_title`               | `text`          |     | nvarchar(30)    |
| 9   | `e_mail`                  | `text`          |     | nvarchar(80)    |
| 10  | `manager_no_`             | `text`          |     | nvarchar(20)    |
| 11  | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 12  | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |

### fixed_asset

**Original NAV Table:** `Fixed Asset`  
**Columns:** 21  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)    |
| 4   | `description`             | `text`          |     | nvarchar(50)    |
| 5   | `search_description`      | `text`          |     | nvarchar(50)    |
| 6   | `description_2`           | `text`          |     | nvarchar(50)    |
| 7   | `fa_class_code`           | `text`          |     | nvarchar(10)    |
| 8   | `fa_subclass_code`        | `text`          |     | nvarchar(10)    |
| 9   | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 10  | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |
| 11  | `location_code`           | `text`          |     | nvarchar(10)    |
| 12  | `fa_location_code`        | `text`          |     | nvarchar(10)    |
| 13  | `vendor_no_`              | `text`          |     | nvarchar(20)    |
| 14  | `responsible_employee`    | `text`          |     | nvarchar(20)    |
| 15  | `serial_no_`              | `text`          |     | nvarchar(30)    |
| 16  | `blocked`                 | `boolean`       |     | tinyint         |
| 17  | `maintenance_vendor_no_`  | `text`          |     | nvarchar(20)    |
| 18  | `under_maintenance`       | `smallint`      |     | tinyint         |
| 19  | `inactive`                | `boolean`       |     | tinyint         |
| 20  | `no_series`               | `text`          |     | nvarchar(20)    |
| 21  | `fa_posting_group`        | `text`          |     | nvarchar(20)    |

### gsf_item_cost

**Original NAV Table:** `GSF Item Cost`  
**Columns:** 10  
**Primary Key:** `(source_db, location_code, item_no_, code)`

| #   | Column Name         | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------- | --------------- | --- | --------------- |
| 1   | `source_db`         | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`              | `text`          |     | nvarchar(66)    |
| 3   | `location_code`     | `text`          | ✓   | nvarchar(20)    |
| 4   | `item_no_`          | `text`          | ✓   | nvarchar(20)    |
| 5   | `code`              | `text`          | ✓   | nvarchar(20)    |
| 6   | `amount`            | `decimal`       |     | decimal         |
| 7   | `amount_type`       | `integer`       |     | int             |
| 8   | `calculated_amount` | `decimal`       |     | decimal         |
| 9   | `validfrom`         | `timestamptz`   |     | datetime2       |
| 10  | `validto`           | `timestamptz`   |     | datetime2       |

### gsf_item_cost_history

**Original NAV Table:** `GSF Item Cost History`  
**Columns:** 10  
**Primary Key:** `(None)`

| #   | Column Name         | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------- | --------------- | --- | --------------- |
| 1   | `source_db`         | `text`          |     | nvarchar(20)    |
| 2   | `hash`              | `text`          |     | nvarchar(66)    |
| 3   | `location_code`     | `text`          |     | nvarchar(20)    |
| 4   | `item_no_`          | `text`          |     | nvarchar(20)    |
| 5   | `code`              | `text`          |     | nvarchar(20)    |
| 6   | `amount`            | `decimal`       |     | decimal         |
| 7   | `amount_type`       | `integer`       |     | int             |
| 8   | `calculated_amount` | `decimal`       |     | decimal         |
| 9   | `validfrom`         | `timestamptz`   |     | datetime2       |
| 10  | `validto`           | `timestamptz`   |     | datetime2       |

### gsf_item_usage

**Original NAV Table:** `GSF Item Usage`  
**Columns:** 19  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                     | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                | `integer`       | ✓   | int             |
| 4   | `location_code`            | `text`          |     | nvarchar(20)    |
| 5   | `item_no_`                 | `text`          |     | nvarchar(20)    |
| 6   | `entry_type`               | `integer`       |     | int             |
| 7   | `posting_date`             | `timestamptz`   |     | datetime        |
| 8   | `month`                    | `integer`       |     | int             |
| 9   | `week`                     | `integer`       |     | int             |
| 10  | `year`                     | `integer`       |     | int             |
| 11  | `document_no_`             | `text`          |     | nvarchar(20)    |
| 12  | `document_type`            | `integer`       |     | int             |
| 13  | `source_no_`               | `text`          |     | nvarchar(20)    |
| 14  | `source_type`              | `integer`       |     | int             |
| 15  | `quantity`                 | `decimal`       |     | decimal         |
| 16  | `qty_per_unit_of_measure`  | `decimal`       |     | decimal         |
| 17  | `unit_of_measure_code`     | `text`          |     | nvarchar(10)    |
| 18  | `redirected_from_item_no_` | `text`          |     | nvarchar(20)    |
| 19  | `bill_to_customer_no_`     | `text`          |     | nvarchar(20)    |

### gsf_sales_price

**Original NAV Table:** `GSF Sales Price`  
**Columns:** 11  
**Primary Key:** `(source_db, bill_to_customer_no_, item_no_, unit_of_measure_code)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `bill_to_customer_no_` | `text`          | ✓   | nvarchar(20)    |
| 4   | `item_no_`             | `text`          | ✓   | nvarchar(20)    |
| 5   | `unit_of_measure_code` | `text`          | ✓   | nvarchar(20)    |
| 6   | `unit_price`           | `decimal`       |     | decimal         |
| 7   | `contract_item`        | `boolean`       |     | tinyint         |
| 8   | `bid_code`             | `text`          |     | nvarchar(20)    |
| 9   | `last_date_updated`    | `timestamptz`   |     | datetime        |
| 10  | `starting_date`        | `timestamptz`   |     | datetime        |
| 11  | `ending_date`          | `timestamptz`   |     | datetime        |

### g_l_account

**Original NAV Table:** `G_L Account`  
**Columns:** 22  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL  |
| --- | ------------------------- | --------------- | --- | ---------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(10)     |
| 2   | `hash`                    | `text`          |     | nvarchar(66)     |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)     |
| 4   | `name`                    | `text`          |     | nvarchar(50)     |
| 5   | `search_name`             | `text`          |     | nvarchar(50)     |
| 6   | `account_type`            | `integer`       |     | int              |
| 7   | `global_dimension_1_code` | `text`          |     | nvarchar(20)     |
| 8   | `global_dimension_2_code` | `text`          |     | nvarchar(20)     |
| 9   | `account_category`        | `integer`       |     | int              |
| 10  | `income_balance`          | `integer`       |     | int              |
| 11  | `debit_credit`            | `integer`       |     | int              |
| 12  | `no_2`                    | `text`          |     | nvarchar(20)     |
| 13  | `blocked`                 | `boolean`       |     | tinyint          |
| 14  | `direct_posting`          | `smallint`      |     | tinyint          |
| 15  | `reconciliation_account`  | `smallint`      |     | tinyint          |
| 16  | `gen_posting_type`        | `integer`       |     | int              |
| 17  | `gen_bus_posting_group`   | `text`          |     | nvarchar(20)     |
| 18  | `gen_prod_posting_group`  | `text`          |     | nvarchar(20)     |
| 19  | `tax_area_code`           | `text`          |     | nvarchar(20)     |
| 20  | `tax_liable`              | `boolean`       |     | tinyint          |
| 21  | `tax_group_code`          | `text`          |     | nvarchar(20)     |
| 22  | `id`                      | `uuid`          |     | uniqueidentifier |

### g_l_entry

**Original NAV Table:** `G_L Entry`  
**Columns:** 28  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `entry_no_`               | `integer`       | ✓   | int             |
| 3   | `g_l_account_no_`         | `text`          |     | nvarchar(20)    |
| 4   | `posting_date`            | `timestamptz`   |     | datetime        |
| 5   | `document_type`           | `integer`       |     | int             |
| 6   | `document_no_`            | `text`          |     | nvarchar(20)    |
| 7   | `description`             | `text`          |     | nvarchar(50)    |
| 8   | `bal_account_no_`         | `text`          |     | nvarchar(20)    |
| 9   | `amount`                  | `decimal`       |     | decimal         |
| 10  | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 11  | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |
| 12  | `user_id`                 | `text`          |     | nvarchar(50)    |
| 13  | `source_code`             | `text`          |     | nvarchar(10)    |
| 14  | `quantity`                | `decimal`       |     | decimal         |
| 15  | `journal_batch_name`      | `text`          |     | nvarchar(10)    |
| 16  | `reason_code`             | `text`          |     | nvarchar(10)    |
| 17  | `gen_posting_type`        | `integer`       |     | int             |
| 18  | `gen_bus_posting_group`   | `text`          |     | nvarchar(20)    |
| 19  | `gen_prod_posting_group`  | `text`          |     | nvarchar(20)    |
| 20  | `transaction_no_`         | `integer`       |     | int             |
| 21  | `debit_amount`            | `decimal`       |     | decimal         |
| 22  | `credit_amount`           | `decimal`       |     | decimal         |
| 23  | `document_date`           | `timestamptz`   |     | datetime        |
| 24  | `source_type`             | `integer`       |     | int             |
| 25  | `source_no_`              | `text`          |     | nvarchar(20)    |
| 26  | `no_series`               | `text`          |     | nvarchar(20)    |
| 27  | `dimension_set_id`        | `integer`       |     | int             |
| 28  | `external_document_no_`   | `text`          |     | nvarchar(35)    |

### item

**Original NAV Table:** `Item`  
**Columns:** 108  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                      | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------------- | --------------- | --- | --------------- |
| 1   | `validfrom`                      | `timestamptz`   |     | datetime2       |
| 2   | `validto`                        | `timestamptz`   |     | datetime2       |
| 3   | `source_db`                      | `text`          | ✓   | nvarchar(20)    |
| 4   | `hash`                           | `text`          |     | nvarchar(66)    |
| 5   | `no_`                            | `text`          | ✓   | nvarchar(20)    |
| 6   | `no_2`                           | `text`          |     | nvarchar(20)    |
| 7   | `description`                    | `text`          |     | nvarchar(50)    |
| 8   | `description_2`                  | `text`          |     | nvarchar(50)    |
| 9   | `base_unit_of_measure`           | `text`          |     | nvarchar(10)    |
| 10  | `price_unit_conversion`          | `integer`       |     | int             |
| 11  | `type`                           | `integer`       |     | int             |
| 12  | `inventory_posting_group`        | `text`          |     | nvarchar(20)    |
| 13  | `item_disc_group`                | `text`          |     | nvarchar(20)    |
| 14  | `allow_invoice_disc`             | `boolean`       |     | tinyint         |
| 15  | `unit_price`                     | `decimal`       |     | decimal         |
| 16  | `price_profit_calculation`       | `integer`       |     | int             |
| 17  | `profit`                         | `decimal`       |     | decimal         |
| 18  | `costing_method`                 | `integer`       |     | int             |
| 19  | `unit_cost`                      | `decimal`       |     | decimal         |
| 20  | `last_direct_cost`               | `decimal`       |     | decimal         |
| 21  | `cost_is_adjusted`               | `boolean`       |     | tinyint         |
| 22  | `allow_online_adjustment`        | `boolean`       |     | tinyint         |
| 23  | `vendor_no_`                     | `text`          |     | nvarchar(20)    |
| 24  | `vendor_item_no_`                | `text`          |     | nvarchar(20)    |
| 25  | `lead_time_calculation`          | `varchar(32)`   |     | varchar(32)     |
| 26  | `reorder_point`                  | `decimal`       |     | decimal         |
| 27  | `maximum_inventory`              | `decimal`       |     | decimal         |
| 28  | `reorder_quantity`               | `decimal`       |     | decimal         |
| 29  | `alternative_item_no_`           | `text`          |     | nvarchar(20)    |
| 30  | `unit_list_price`                | `decimal`       |     | decimal         |
| 31  | `gross_weight`                   | `decimal`       |     | decimal         |
| 32  | `net_weight`                     | `decimal`       |     | decimal         |
| 33  | `units_per_parcel`               | `decimal`       |     | decimal         |
| 34  | `unit_volume`                    | `decimal`       |     | decimal         |
| 35  | `country_region_purchased_code`  | `text`          |     | nvarchar(10)    |
| 36  | `blocked`                        | `boolean`       |     | tinyint         |
| 37  | `block_reason`                   | `text`          |     | nvarchar(250)   |
| 38  | `gen_prod_posting_group`         | `text`          |     | nvarchar(20)    |
| 39  | `country_region_of_origin_code`  | `text`          |     | nvarchar(10)    |
| 40  | `reserve`                        | `integer`       |     | int             |
| 41  | `global_dimension_1_code`        | `text`          |     | nvarchar(20)    |
| 42  | `global_dimension_2_code`        | `text`          |     | nvarchar(20)    |
| 43  | `lot_size`                       | `decimal`       |     | decimal         |
| 44  | `last_unit_cost_calc_date`       | `timestamptz`   |     | datetime        |
| 45  | `minimum_order_quantity`         | `decimal`       |     | decimal         |
| 46  | `safety_stock_quantity`          | `decimal`       |     | decimal         |
| 47  | `order_multiple`                 | `decimal`       |     | decimal         |
| 48  | `safety_lead_time`               | `varchar(32)`   |     | varchar(32)     |
| 49  | `sales_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 50  | `purch_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 51  | `reordering_policy`              | `integer`       |     | int             |
| 52  | `include_inventory`              | `boolean`       |     | tinyint         |
| 53  | `manufacturer_code`              | `text`          |     | nvarchar(10)    |
| 54  | `item_category_code`             | `text`          |     | nvarchar(20)    |
| 55  | `product_group_code`             | `text`          |     | nvarchar(10)    |
| 56  | `phys_invt_counting_period_code` | `text`          |     | nvarchar(10)    |
| 57  | `last_counting_period_update`    | `timestamptz`   |     | datetime        |
| 58  | `use_cross_docking`              | `boolean`       |     | tinyint         |
| 59  | `next_counting_start_date`       | `timestamptz`   |     | datetime        |
| 60  | `next_counting_end_date`         | `timestamptz`   |     | datetime        |
| 61  | `expiration_date_type`           | `integer`       |     | int             |
| 62  | `expiration_date_rule`           | `integer`       |     | int             |
| 63  | `buyer_code`                     | `text`          |     | nvarchar(20)    |
| 64  | `crv`                            | `decimal`       |     | decimal         |
| 65  | `shelf_life_in_days`             | `integer`       |     | int             |
| 66  | `shelf_life`                     | `text`          |     | nvarchar(3)     |
| 67  | `specials_list`                  | `smallint`      |     | tinyint         |
| 68  | `sodexo_only`                    | `smallint`      |     | tinyint         |
| 69  | `pack_size`                      | `text`          |     | nvarchar(10)    |
| 70  | `item_class`                     | `text`          |     | nvarchar(20)    |
| 71  | `active_since`                   | `timestamptz`   |     | datetime        |
| 72  | `current_vendor_no_`             | `text`          |     | nvarchar(20)    |
| 73  | `commodity_dependency`           | `integer`       |     | int             |
| 74  | `commodity_fee_basis`            | `integer`       |     | int             |
| 75  | `fair_market_value`              | `decimal`       |     | decimal         |
| 76  | `cmdy_value_exception`           | `smallint`      |     | tinyint         |
| 77  | `df_lb_per_case`                 | `decimal`       |     | decimal         |
| 78  | `commodity_additional_allowance` | `decimal`       |     | decimal         |
| 79  | `onelink_order_guide`            | `integer`       |     | int             |
| 80  | `market_price_item`              | `boolean`       |     | tinyint         |
| 81  | `zero_price_allowed`             | `boolean`       |     | tinyint         |
| 82  | `zone`                           | `text`          |     | nvarchar(20)    |
| 83  | `repack_item_no_`                | `text`          |     | nvarchar(20)    |
| 84  | `repack_qty`                     | `decimal`       |     | decimal         |
| 85  | `lb_item_no_`                    | `text`          |     | nvarchar(20)    |
| 86  | `master_item_no_`                | `text`          |     | nvarchar(20)    |
| 87  | `master_item`                    | `boolean`       |     | tinyint         |
| 88  | `njpa`                           | `boolean`       |     | tinyint         |
| 89  | `always_create_pick`             | `boolean`       |     | tinyint         |
| 90  | `status`                         | `text`          |     | nvarchar(20)    |
| 91  | `rebate_vendor_no_`              | `text`          |     | nvarchar(10)    |
| 92  | `catch_weight`                   | `boolean`       |     | tinyint         |
| 93  | `use_unit_of_measure_dimensions` | `boolean`       |     | tinyint         |
| 94  | `producer_of_good_indicator`     | `integer`       |     | int             |
| 95  | `item_upc_ean_number`            | `text`          |     | nvarchar(20)    |
| 96  | `routing_no_`                    | `text`          |     | nvarchar(20)    |
| 97  | `production_bom_no_`             | `text`          |     | nvarchar(20)    |
| 98  | `order_tracking_policy`          | `integer`       |     | int             |
| 99  | `critical`                       | `boolean`       |     | tinyint         |
| 100 | `suggested_weeks_on_hand`        | `decimal`       |     | decimal         |
| 101 | `city_state_zip_code_of_origin`  | `text`          |     | nvarchar(50)    |
| 102 | `category_class_code`            | `text`          |     | nvarchar(20)    |
| 103 | `gtin`                           | `text`          |     | nvarchar(14)    |
| 104 | `mfg_name`                       | `text`          |     | nvarchar(30)    |
| 105 | `non_domestic`                   | `boolean`       |     | tinyint         |
| 106 | `food_item`                      | `boolean`       |     | tinyint         |
| 107 | `last_direct_lb_cost`            | `decimal`       |     | decimal         |
| 108 | `exception_type`                 | `text`          |     | nvarchar(20)    |

### item_application_entry

**Original NAV Table:** `Item Application Entry`  
**Columns:** 16  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                   | PostgreSQL Type | PK  | Original MS SQL |
| --- | ----------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                   | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                        | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                   | `integer`       | ✓   | int             |
| 4   | `item_ledger_entry_no_`       | `integer`       |     | int             |
| 5   | `inbound_item_entry_no_`      | `integer`       |     | int             |
| 6   | `outbound_item_entry_no_`     | `integer`       |     | int             |
| 7   | `quantity`                    | `decimal`       |     | decimal         |
| 8   | `posting_date`                | `timestamptz`   |     | datetime        |
| 9   | `transferred_from_entry_no_`  | `integer`       |     | int             |
| 10  | `creation_date`               | `timestamptz`   |     | datetime        |
| 11  | `created_by_user`             | `text`          |     | nvarchar(50)    |
| 12  | `last_modified_date`          | `timestamptz`   |     | datetime        |
| 13  | `last_modified_by_user`       | `text`          |     | nvarchar(50)    |
| 14  | `cost_application`            | `smallint`      |     | tinyint         |
| 15  | `output_completely_invd_date` | `timestamptz`   |     | datetime        |
| 16  | `outbound_entry_is_updated`   | `boolean`       |     | tinyint         |

### item_charge

**Original NAV Table:** `Item Charge`  
**Columns:** 10  
**Primary Key:** `(source_db, no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `no_`                     | `text`          | ✓   | nvarchar(20)    |
| 4   | `description`             | `text`          |     | nvarchar(50)    |
| 5   | `gen_prod_posting_group`  | `text`          |     | nvarchar(20)    |
| 6   | `tax_group_code`          | `text`          |     | nvarchar(20)    |
| 7   | `vat_prod_posting_group`  | `text`          |     | nvarchar(20)    |
| 8   | `search_description`      | `text`          |     | nvarchar(50)    |
| 9   | `global_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 10  | `global_dimension_2_code` | `text`          |     | nvarchar(20)    |

### item_date_range

**Original NAV Table:** `Item Date Range`  
**Columns:** 9  
**Primary Key:** `(source_db, item_no_, code, starting_date)`

| #   | Column Name     | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------- | --------------- | --- | --------------- |
| 1   | `source_db`     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`          | `text`          |     | nvarchar(66)    |
| 3   | `item_no_`      | `text`          | ✓   | nvarchar(20)    |
| 4   | `code`          | `text`          | ✓   | nvarchar(20)    |
| 5   | `starting_date` | `timestamptz`   | ✓   | datetime        |
| 6   | `ending_date`   | `timestamptz`   |     | datetime        |
| 7   | `quantity`      | `decimal`       |     | decimal         |
| 8   | `amount`        | `decimal`       |     | decimal         |
| 9   | `text`          | `text`          |     | nvarchar(50)    |

### item_grouping

**Original NAV Table:** `Item Grouping`  
**Columns:** 7  
**Primary Key:** `(source_db, type, code, item_type, item_code)`

| #   | Column Name | PostgreSQL Type | PK  | Original MS SQL |
| --- | ----------- | --------------- | --- | --------------- |
| 1   | `source_db` | `text`          | ✓   | nvarchar(10)    |
| 2   | `hash`      | `text`          |     | nvarchar(66)    |
| 3   | `type`      | `text`          | ✓   | nvarchar(10)    |
| 4   | `code`      | `text`          | ✓   | nvarchar(20)    |
| 5   | `item_type` | `integer`       | ✓   | int             |
| 6   | `item_code` | `text`          | ✓   | nvarchar(20)    |
| 7   | `exclude`   | `boolean`       |     | tinyint         |

### item_history

**Original NAV Table:** `Item History`  
**Columns:** 108  
**Primary Key:** `(None)`

| #   | Column Name                      | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------------- | --------------- | --- | --------------- |
| 1   | `validfrom`                      | `timestamptz`   |     | datetime2       |
| 2   | `validto`                        | `timestamptz`   |     | datetime2       |
| 3   | `source_db`                      | `text`          |     | nvarchar(20)    |
| 4   | `hash`                           | `text`          |     | nvarchar(66)    |
| 5   | `no_`                            | `text`          |     | nvarchar(20)    |
| 6   | `no_2`                           | `text`          |     | nvarchar(20)    |
| 7   | `description`                    | `text`          |     | nvarchar(50)    |
| 8   | `description_2`                  | `text`          |     | nvarchar(50)    |
| 9   | `base_unit_of_measure`           | `text`          |     | nvarchar(10)    |
| 10  | `price_unit_conversion`          | `integer`       |     | int             |
| 11  | `type`                           | `integer`       |     | int             |
| 12  | `inventory_posting_group`        | `text`          |     | nvarchar(20)    |
| 13  | `item_disc_group`                | `text`          |     | nvarchar(20)    |
| 14  | `allow_invoice_disc`             | `boolean`       |     | tinyint         |
| 15  | `unit_price`                     | `decimal`       |     | decimal         |
| 16  | `price_profit_calculation`       | `integer`       |     | int             |
| 17  | `profit`                         | `decimal`       |     | decimal         |
| 18  | `costing_method`                 | `integer`       |     | int             |
| 19  | `unit_cost`                      | `decimal`       |     | decimal         |
| 20  | `last_direct_cost`               | `decimal`       |     | decimal         |
| 21  | `cost_is_adjusted`               | `boolean`       |     | tinyint         |
| 22  | `allow_online_adjustment`        | `boolean`       |     | tinyint         |
| 23  | `vendor_no_`                     | `text`          |     | nvarchar(20)    |
| 24  | `vendor_item_no_`                | `text`          |     | nvarchar(20)    |
| 25  | `lead_time_calculation`          | `varchar(32)`   |     | varchar(32)     |
| 26  | `reorder_point`                  | `decimal`       |     | decimal         |
| 27  | `maximum_inventory`              | `decimal`       |     | decimal         |
| 28  | `reorder_quantity`               | `decimal`       |     | decimal         |
| 29  | `alternative_item_no_`           | `text`          |     | nvarchar(20)    |
| 30  | `unit_list_price`                | `decimal`       |     | decimal         |
| 31  | `gross_weight`                   | `decimal`       |     | decimal         |
| 32  | `net_weight`                     | `decimal`       |     | decimal         |
| 33  | `units_per_parcel`               | `decimal`       |     | decimal         |
| 34  | `unit_volume`                    | `decimal`       |     | decimal         |
| 35  | `country_region_purchased_code`  | `text`          |     | nvarchar(10)    |
| 36  | `blocked`                        | `boolean`       |     | tinyint         |
| 37  | `block_reason`                   | `text`          |     | nvarchar(250)   |
| 38  | `gen_prod_posting_group`         | `text`          |     | nvarchar(20)    |
| 39  | `country_region_of_origin_code`  | `text`          |     | nvarchar(10)    |
| 40  | `reserve`                        | `integer`       |     | int             |
| 41  | `global_dimension_1_code`        | `text`          |     | nvarchar(20)    |
| 42  | `global_dimension_2_code`        | `text`          |     | nvarchar(20)    |
| 43  | `lot_size`                       | `decimal`       |     | decimal         |
| 44  | `last_unit_cost_calc_date`       | `timestamptz`   |     | datetime        |
| 45  | `minimum_order_quantity`         | `decimal`       |     | decimal         |
| 46  | `safety_stock_quantity`          | `decimal`       |     | decimal         |
| 47  | `order_multiple`                 | `decimal`       |     | decimal         |
| 48  | `safety_lead_time`               | `varchar(32)`   |     | varchar(32)     |
| 49  | `sales_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 50  | `purch_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 51  | `reordering_policy`              | `integer`       |     | int             |
| 52  | `include_inventory`              | `boolean`       |     | tinyint         |
| 53  | `manufacturer_code`              | `text`          |     | nvarchar(10)    |
| 54  | `item_category_code`             | `text`          |     | nvarchar(20)    |
| 55  | `product_group_code`             | `text`          |     | nvarchar(10)    |
| 56  | `phys_invt_counting_period_code` | `text`          |     | nvarchar(10)    |
| 57  | `last_counting_period_update`    | `timestamptz`   |     | datetime        |
| 58  | `use_cross_docking`              | `boolean`       |     | tinyint         |
| 59  | `next_counting_start_date`       | `timestamptz`   |     | datetime        |
| 60  | `next_counting_end_date`         | `timestamptz`   |     | datetime        |
| 61  | `expiration_date_type`           | `integer`       |     | int             |
| 62  | `expiration_date_rule`           | `integer`       |     | int             |
| 63  | `buyer_code`                     | `text`          |     | nvarchar(20)    |
| 64  | `crv`                            | `decimal`       |     | decimal         |
| 65  | `shelf_life_in_days`             | `integer`       |     | int             |
| 66  | `shelf_life`                     | `text`          |     | nvarchar(3)     |
| 67  | `specials_list`                  | `smallint`      |     | tinyint         |
| 68  | `sodexo_only`                    | `smallint`      |     | tinyint         |
| 69  | `pack_size`                      | `text`          |     | nvarchar(10)    |
| 70  | `item_class`                     | `text`          |     | nvarchar(20)    |
| 71  | `active_since`                   | `timestamptz`   |     | datetime        |
| 72  | `current_vendor_no_`             | `text`          |     | nvarchar(20)    |
| 73  | `commodity_dependency`           | `integer`       |     | int             |
| 74  | `commodity_fee_basis`            | `integer`       |     | int             |
| 75  | `fair_market_value`              | `decimal`       |     | decimal         |
| 76  | `cmdy_value_exception`           | `smallint`      |     | tinyint         |
| 77  | `df_lb_per_case`                 | `decimal`       |     | decimal         |
| 78  | `commodity_additional_allowance` | `decimal`       |     | decimal         |
| 79  | `onelink_order_guide`            | `integer`       |     | int             |
| 80  | `market_price_item`              | `boolean`       |     | tinyint         |
| 81  | `zero_price_allowed`             | `boolean`       |     | tinyint         |
| 82  | `zone`                           | `text`          |     | nvarchar(20)    |
| 83  | `repack_item_no_`                | `text`          |     | nvarchar(20)    |
| 84  | `repack_qty`                     | `decimal`       |     | decimal         |
| 85  | `lb_item_no_`                    | `text`          |     | nvarchar(20)    |
| 86  | `master_item_no_`                | `text`          |     | nvarchar(20)    |
| 87  | `master_item`                    | `boolean`       |     | tinyint         |
| 88  | `njpa`                           | `boolean`       |     | tinyint         |
| 89  | `always_create_pick`             | `boolean`       |     | tinyint         |
| 90  | `status`                         | `text`          |     | nvarchar(20)    |
| 91  | `rebate_vendor_no_`              | `text`          |     | nvarchar(10)    |
| 92  | `catch_weight`                   | `boolean`       |     | tinyint         |
| 93  | `use_unit_of_measure_dimensions` | `boolean`       |     | tinyint         |
| 94  | `producer_of_good_indicator`     | `integer`       |     | int             |
| 95  | `item_upc_ean_number`            | `text`          |     | nvarchar(20)    |
| 96  | `routing_no_`                    | `text`          |     | nvarchar(20)    |
| 97  | `production_bom_no_`             | `text`          |     | nvarchar(20)    |
| 98  | `order_tracking_policy`          | `integer`       |     | int             |
| 99  | `critical`                       | `boolean`       |     | tinyint         |
| 100 | `suggested_weeks_on_hand`        | `decimal`       |     | decimal         |
| 101 | `city_state_zip_code_of_origin`  | `text`          |     | nvarchar(50)    |
| 102 | `category_class_code`            | `text`          |     | nvarchar(20)    |
| 103 | `gtin`                           | `text`          |     | nvarchar(14)    |
| 104 | `mfg_name`                       | `text`          |     | nvarchar(30)    |
| 105 | `non_domestic`                   | `boolean`       |     | tinyint         |
| 106 | `food_item`                      | `boolean`       |     | tinyint         |
| 107 | `last_direct_lb_cost`            | `decimal`       |     | decimal         |
| 108 | `exception_type`                 | `text`          |     | nvarchar(20)    |

### item_ledger_entry

**Original NAV Table:** `Item Ledger Entry`  
**Columns:** 47  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name                | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                     | `text`          |     | nvarchar(66)    |
| 3   | `entry_no_`                | `integer`       | ✓   | int             |
| 4   | `item_no_`                 | `text`          |     | nvarchar(20)    |
| 5   | `posting_date`             | `timestamptz`   |     | datetime        |
| 6   | `entry_type`               | `integer`       |     | int             |
| 7   | `source_no_`               | `text`          |     | nvarchar(20)    |
| 8   | `document_no_`             | `text`          |     | nvarchar(20)    |
| 9   | `description`              | `text`          |     | nvarchar(50)    |
| 10  | `location_code`            | `text`          |     | nvarchar(10)    |
| 11  | `quantity`                 | `decimal`       |     | decimal         |
| 12  | `remaining_quantity`       | `decimal`       |     | decimal         |
| 13  | `invoiced_quantity`        | `decimal`       |     | decimal         |
| 14  | `applies_to_entry`         | `integer`       |     | int             |
| 15  | `open`                     | `boolean`       |     | tinyint         |
| 16  | `global_dimension_1_code`  | `text`          |     | nvarchar(20)    |
| 17  | `global_dimension_2_code`  | `text`          |     | nvarchar(20)    |
| 18  | `positive`                 | `boolean`       |     | tinyint         |
| 19  | `source_type`              | `integer`       |     | int             |
| 20  | `drop_shipment`            | `boolean`       |     | tinyint         |
| 21  | `country_region_code`      | `text`          |     | nvarchar(10)    |
| 22  | `document_date`            | `timestamptz`   |     | datetime        |
| 23  | `external_document_no_`    | `text`          |     | nvarchar(35)    |
| 24  | `no_series`                | `text`          |     | nvarchar(20)    |
| 25  | `document_type`            | `integer`       |     | int             |
| 26  | `document_line_no_`        | `integer`       |     | int             |
| 27  | `order_type`               | `integer`       |     | int             |
| 28  | `order_no_`                | `text`          |     | nvarchar(20)    |
| 29  | `order_line_no_`           | `integer`       |     | int             |
| 30  | `dimension_set_id`         | `integer`       |     | int             |
| 31  | `assemble_to_order`        | `boolean`       |     | tinyint         |
| 32  | `variant_code`             | `text`          |     | nvarchar(10)    |
| 33  | `qty_per_unit_of_measure`  | `decimal`       |     | decimal         |
| 34  | `unit_of_measure_code`     | `text`          |     | nvarchar(10)    |
| 35  | `item_category_code`       | `text`          |     | nvarchar(20)    |
| 36  | `product_group_code`       | `text`          |     | nvarchar(10)    |
| 37  | `completely_invoiced`      | `boolean`       |     | tinyint         |
| 38  | `last_invoice_date`        | `timestamptz`   |     | datetime        |
| 39  | `correction`               | `boolean`       |     | tinyint         |
| 40  | `shipped_qty_not_returned` | `decimal`       |     | decimal         |
| 41  | `lot_no_`                  | `text`          |     | nvarchar(20)    |
| 42  | `expiration_date`          | `timestamptz`   |     | datetime        |
| 43  | `item_tracking`            | `integer`       |     | int             |
| 44  | `return_reason_code`       | `text`          |     | nvarchar(10)    |
| 45  | `bill_to_customer_no_`     | `text`          |     | nvarchar(20)    |
| 46  | `reason_code`              | `text`          |     | nvarchar(10)    |
| 47  | `true_posting_date_time`   | `timestamptz`   |     | datetime        |

### item_old

**Original NAV Table:** `Item OLD`  
**Columns:** 103  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                      | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                      | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                           | `text`          |     | nvarchar(66)    |
| 3   | `no_`                            | `text`          | ✓   | nvarchar(20)    |
| 4   | `no_2`                           | `text`          |     | nvarchar(20)    |
| 5   | `description`                    | `text`          |     | nvarchar(50)    |
| 6   | `description_2`                  | `text`          |     | nvarchar(50)    |
| 7   | `base_unit_of_measure`           | `text`          |     | nvarchar(10)    |
| 8   | `price_unit_conversion`          | `integer`       |     | int             |
| 9   | `type`                           | `integer`       |     | int             |
| 10  | `inventory_posting_group`        | `text`          |     | nvarchar(20)    |
| 11  | `item_disc_group`                | `text`          |     | nvarchar(20)    |
| 12  | `allow_invoice_disc`             | `boolean`       |     | tinyint         |
| 13  | `unit_price`                     | `decimal`       |     | decimal         |
| 14  | `price_profit_calculation`       | `integer`       |     | int             |
| 15  | `profit`                         | `decimal`       |     | decimal         |
| 16  | `costing_method`                 | `integer`       |     | int             |
| 17  | `unit_cost`                      | `decimal`       |     | decimal         |
| 18  | `last_direct_cost`               | `decimal`       |     | decimal         |
| 19  | `cost_is_adjusted`               | `boolean`       |     | tinyint         |
| 20  | `allow_online_adjustment`        | `boolean`       |     | tinyint         |
| 21  | `vendor_no_`                     | `text`          |     | nvarchar(20)    |
| 22  | `vendor_item_no_`                | `text`          |     | nvarchar(20)    |
| 23  | `lead_time_calculation`          | `varchar(32)`   |     | varchar(32)     |
| 24  | `reorder_point`                  | `decimal`       |     | decimal         |
| 25  | `maximum_inventory`              | `decimal`       |     | decimal         |
| 26  | `reorder_quantity`               | `decimal`       |     | decimal         |
| 27  | `alternative_item_no_`           | `text`          |     | nvarchar(20)    |
| 28  | `unit_list_price`                | `decimal`       |     | decimal         |
| 29  | `gross_weight`                   | `decimal`       |     | decimal         |
| 30  | `net_weight`                     | `decimal`       |     | decimal         |
| 31  | `units_per_parcel`               | `decimal`       |     | decimal         |
| 32  | `unit_volume`                    | `decimal`       |     | decimal         |
| 33  | `country_region_purchased_code`  | `text`          |     | nvarchar(10)    |
| 34  | `blocked`                        | `boolean`       |     | tinyint         |
| 35  | `block_reason`                   | `text`          |     | nvarchar(250)   |
| 36  | `gen_prod_posting_group`         | `text`          |     | nvarchar(20)    |
| 37  | `country_region_of_origin_code`  | `text`          |     | nvarchar(10)    |
| 38  | `reserve`                        | `integer`       |     | int             |
| 39  | `global_dimension_1_code`        | `text`          |     | nvarchar(20)    |
| 40  | `global_dimension_2_code`        | `text`          |     | nvarchar(20)    |
| 41  | `lot_size`                       | `decimal`       |     | decimal         |
| 42  | `last_unit_cost_calc_date`       | `timestamptz`   |     | datetime        |
| 43  | `minimum_order_quantity`         | `decimal`       |     | decimal         |
| 44  | `safety_stock_quantity`          | `decimal`       |     | decimal         |
| 45  | `order_multiple`                 | `decimal`       |     | decimal         |
| 46  | `safety_lead_time`               | `varchar(32)`   |     | varchar(32)     |
| 47  | `sales_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 48  | `purch_unit_of_measure`          | `text`          |     | nvarchar(10)    |
| 49  | `reordering_policy`              | `integer`       |     | int             |
| 50  | `include_inventory`              | `boolean`       |     | tinyint         |
| 51  | `manufacturer_code`              | `text`          |     | nvarchar(10)    |
| 52  | `item_category_code`             | `text`          |     | nvarchar(20)    |
| 53  | `product_group_code`             | `text`          |     | nvarchar(10)    |
| 54  | `phys_invt_counting_period_code` | `text`          |     | nvarchar(10)    |
| 55  | `last_counting_period_update`    | `timestamptz`   |     | datetime        |
| 56  | `use_cross_docking`              | `boolean`       |     | tinyint         |
| 57  | `next_counting_start_date`       | `timestamptz`   |     | datetime        |
| 58  | `next_counting_end_date`         | `timestamptz`   |     | datetime        |
| 59  | `expiration_date_type`           | `integer`       |     | int             |
| 60  | `expiration_date_rule`           | `integer`       |     | int             |
| 61  | `buyer_code`                     | `text`          |     | nvarchar(20)    |
| 62  | `crv`                            | `decimal`       |     | decimal         |
| 63  | `shelf_life_in_days`             | `integer`       |     | int             |
| 64  | `shelf_life`                     | `text`          |     | nvarchar(3)     |
| 65  | `specials_list`                  | `smallint`      |     | tinyint         |
| 66  | `sodexo_only`                    | `smallint`      |     | tinyint         |
| 67  | `pack_size`                      | `text`          |     | nvarchar(10)    |
| 68  | `item_class`                     | `text`          |     | nvarchar(20)    |
| 69  | `active_since`                   | `timestamptz`   |     | datetime        |
| 70  | `current_vendor_no_`             | `text`          |     | nvarchar(20)    |
| 71  | `commodity_dependency`           | `integer`       |     | int             |
| 72  | `commodity_fee_basis`            | `integer`       |     | int             |
| 73  | `fair_market_value`              | `decimal`       |     | decimal         |
| 74  | `cmdy_value_exception`           | `smallint`      |     | tinyint         |
| 75  | `df_lb_per_case`                 | `decimal`       |     | decimal         |
| 76  | `commodity_additional_allowance` | `decimal`       |     | decimal         |
| 77  | `onelink_order_guide`            | `integer`       |     | int             |
| 78  | `market_price_item`              | `boolean`       |     | tinyint         |
| 79  | `zero_price_allowed`             | `boolean`       |     | tinyint         |
| 80  | `zone`                           | `text`          |     | nvarchar(20)    |
| 81  | `repack_item_no_`                | `text`          |     | nvarchar(20)    |
| 82  | `repack_qty`                     | `decimal`       |     | decimal         |
| 83  | `lb_item_no_`                    | `text`          |     | nvarchar(20)    |
| 84  | `master_item_no_`                | `text`          |     | nvarchar(20)    |
| 85  | `master_item`                    | `boolean`       |     | tinyint         |
| 86  | `njpa`                           | `boolean`       |     | tinyint         |
| 87  | `always_create_pick`             | `boolean`       |     | tinyint         |
| 88  | `status`                         | `text`          |     | nvarchar(20)    |
| 89  | `rebate_vendor_no_`              | `text`          |     | nvarchar(10)    |
| 90  | `catch_weight`                   | `boolean`       |     | tinyint         |
| 91  | `use_unit_of_measure_dimensions` | `boolean`       |     | tinyint         |
| 92  | `producer_of_good_indicator`     | `integer`       |     | int             |
| 93  | `item_upc_ean_number`            | `text`          |     | nvarchar(20)    |
| 94  | `routing_no_`                    | `text`          |     | nvarchar(20)    |
| 95  | `production_bom_no_`             | `text`          |     | nvarchar(20)    |
| 96  | `order_tracking_policy`          | `integer`       |     | int             |
| 97  | `critical`                       | `boolean`       |     | tinyint         |
| 98  | `suggested_weeks_on_hand`        | `decimal`       |     | decimal         |
| 99  | `city_state_zip_code_of_origin`  | `text`          |     | nvarchar(50)    |
| 100 | `category_class_code`            | `text`          |     | nvarchar(20)    |
| 101 | `gtin`                           | `text`          |     | nvarchar(14)    |
| 102 | `mfg_name`                       | `text`          |     | nvarchar(30)    |
| 103 | `non_domestic`                   | `boolean`       |     | tinyint         |

### item_spec

**Original NAV Table:** `Item Spec`  
**Columns:** 66  
**Primary Key:** `(source_db, item_no_)`

| #   | Column Name                      | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                      | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                           | `text`          |     | nvarchar(66)    |
| 3   | `item_no_`                       | `text`          | ✓   | nvarchar(20)    |
| 4   | `jan`                            | `boolean`       |     | tinyint         |
| 5   | `feb`                            | `boolean`       |     | tinyint         |
| 6   | `mar`                            | `boolean`       |     | tinyint         |
| 7   | `apr`                            | `boolean`       |     | tinyint         |
| 8   | `may`                            | `boolean`       |     | tinyint         |
| 9   | `jun`                            | `boolean`       |     | tinyint         |
| 10  | `jul`                            | `boolean`       |     | tinyint         |
| 11  | `aug`                            | `boolean`       |     | tinyint         |
| 12  | `sep`                            | `boolean`       |     | tinyint         |
| 13  | `oct`                            | `boolean`       |     | tinyint         |
| 14  | `nov`                            | `boolean`       |     | tinyint         |
| 15  | `dec`                            | `boolean`       |     | tinyint         |
| 16  | `sb12`                           | `smallint`      |     | tinyint         |
| 17  | `sb965`                          | `smallint`      |     | tinyint         |
| 18  | `sb80`                           | `smallint`      |     | tinyint         |
| 19  | `smart_snack`                    | `boolean`       |     | tinyint         |
| 20  | `hhka_non_compliant`             | `smallint`      |     | tinyint         |
| 21  | `alliance_healthgen`             | `smallint`      |     | tinyint         |
| 22  | `california_fresh_meal_program`  | `smallint`      |     | tinyint         |
| 23  | `egg`                            | `smallint`      |     | tinyint         |
| 24  | `soy`                            | `smallint`      |     | tinyint         |
| 25  | `milk`                           | `smallint`      |     | tinyint         |
| 26  | `wheat`                          | `smallint`      |     | tinyint         |
| 27  | `whey`                           | `smallint`      |     | tinyint         |
| 28  | `peanut`                         | `smallint`      |     | tinyint         |
| 29  | `kosher`                         | `boolean`       |     | tinyint         |
| 30  | `51_whole_grain`                 | `smallint`      |     | tinyint         |
| 31  | `highfructosecornsfree`          | `smallint`      |     | tinyint         |
| 32  | `reduced_sodium`                 | `smallint`      |     | tinyint         |
| 33  | `gluten_free`                    | `smallint`      |     | tinyint         |
| 34  | `organic`                        | `boolean`       |     | tinyint         |
| 35  | `biodegradable`                  | `smallint`      |     | tinyint         |
| 36  | `vegetarian`                     | `boolean`       |     | tinyint         |
| 37  | `contains_peanut`                | `smallint`      |     | tinyint         |
| 38  | `recycled_materials`             | `smallint`      |     | tinyint         |
| 39  | `contains_lftp_pink_slime`       | `smallint`      |     | tinyint         |
| 40  | `cn_contributions_breads`        | `decimal`       |     | decimal         |
| 41  | `cn_contributions_meat`          | `decimal`       |     | decimal         |
| 42  | `cn_contributions_fruit`         | `decimal`       |     | decimal         |
| 43  | `cn_contributions_vegetable`     | `decimal`       |     | decimal         |
| 44  | `cn_contributions`               | `text`          |     | nvarchar(50)    |
| 45  | `component_risk`                 | `integer`       |     | int             |
| 46  | `repack_item_no_`                | `text`          |     | nvarchar(20)    |
| 47  | `repack_qty`                     | `decimal`       |     | decimal         |
| 48  | `lb_item_no_`                    | `text`          |     | nvarchar(20)    |
| 49  | `master_item_no_`                | `text`          |     | nvarchar(20)    |
| 50  | `master_item`                    | `boolean`       |     | tinyint         |
| 51  | `servings_per_case`              | `text`          |     | nvarchar(20)    |
| 52  | `peanut_free_facility`           | `smallint`      |     | tinyint         |
| 53  | `cn_labeled`                     | `smallint`      |     | tinyint         |
| 54  | `vegan`                          | `boolean`       |     | tinyint         |
| 55  | `serving_size`                   | `text`          |     | nvarchar(30)    |
| 56  | `units_per_serving`              | `text`          |     | nvarchar(30)    |
| 57  | `pack_quantity`                  | `text`          |     | nvarchar(30)    |
| 58  | `hardy_produce`                  | `smallint`      |     | tinyint         |
| 59  | `processed_produce`              | `smallint`      |     | tinyint         |
| 60  | `local_food_for_schools_program` | `smallint`      |     | tinyint         |
| 61  | `brominated_vegetable_oil`       | `smallint`      |     | tinyint         |
| 62  | `potassium_bromates`             | `smallint`      |     | tinyint         |
| 63  | `propylparaben`                  | `smallint`      |     | tinyint         |
| 64  | `red_dye_3`                      | `smallint`      |     | tinyint         |
| 65  | `sf_best_practices_program`      | `smallint`      |     | tinyint         |
| 66  | `sca_program`                    | `smallint`      |     | tinyint         |

### item_unit_of_measure

**Original NAV Table:** `Item Unit of Measure`  
**Columns:** 13  
**Primary Key:** `(source_db, item_no_, code)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(66)    |
| 3   | `item_no_`                | `text`          | ✓   | nvarchar(20)    |
| 4   | `code`                    | `text`          | ✓   | nvarchar(10)    |
| 5   | `qty_per_unit_of_measure` | `decimal`       |     | decimal         |
| 6   | `length`                  | `decimal`       |     | decimal         |
| 7   | `width`                   | `decimal`       |     | decimal         |
| 8   | `height`                  | `decimal`       |     | decimal         |
| 9   | `cubage`                  | `decimal`       |     | decimal         |
| 10  | `weight`                  | `decimal`       |     | decimal         |
| 11  | `std_pack_upc_ean_number` | `text`          |     | nvarchar(20)    |
| 12  | `max_adjust_qty`          | `decimal`       |     | decimal         |
| 13  | `sync_filter`             | `text`          |     | nvarchar(20)    |

### location

**Original NAV Table:** `Location`  
**Columns:** 127  
**Primary Key:** `(source_db, code)`

| #   | Column Name                      | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                      | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                           | `text`          |     | nvarchar(66)    |
| 3   | `code`                           | `text`          | ✓   | nvarchar(10)    |
| 4   | `name`                           | `text`          |     | nvarchar(50)    |
| 5   | `default_bin_code`               | `text`          |     | nvarchar(20)    |
| 6   | `name_2`                         | `text`          |     | nvarchar(50)    |
| 7   | `address`                        | `text`          |     | nvarchar(50)    |
| 8   | `address_2`                      | `text`          |     | nvarchar(50)    |
| 9   | `city`                           | `text`          |     | nvarchar(30)    |
| 10  | `post_code`                      | `text`          |     | nvarchar(20)    |
| 11  | `county`                         | `text`          |     | nvarchar(30)    |
| 12  | `use_as_in_transit`              | `boolean`       |     | tinyint         |
| 13  | `require_put_away`               | `boolean`       |     | tinyint         |
| 14  | `require_pick`                   | `boolean`       |     | tinyint         |
| 15  | `cross_dock_due_date_calc`       | `varchar(32)`   |     | varchar(32)     |
| 16  | `use_cross_docking`              | `boolean`       |     | tinyint         |
| 17  | `require_receive`                | `boolean`       |     | tinyint         |
| 18  | `require_shipment`               | `boolean`       |     | tinyint         |
| 19  | `bin_mandatory`                  | `smallint`      |     | tinyint         |
| 20  | `directed_put_away_and_pick`     | `boolean`       |     | tinyint         |
| 21  | `default_bin_selection`          | `integer`       |     | int             |
| 22  | `outbound_whse_handling_time`    | `varchar(32)`   |     | varchar(32)     |
| 23  | `inbound_whse_handling_time`     | `varchar(32)`   |     | varchar(32)     |
| 24  | `put_away_template_code`         | `text`          |     | nvarchar(10)    |
| 25  | `use_put_away_worksheet`         | `boolean`       |     | tinyint         |
| 26  | `pick_according_to_fefo`         | `boolean`       |     | tinyint         |
| 27  | `allow_breakbulk`                | `boolean`       |     | tinyint         |
| 28  | `bin_capacity_policy`            | `integer`       |     | int             |
| 29  | `open_shop_floor_bin_code`       | `text`          |     | nvarchar(20)    |
| 30  | `to_production_bin_code`         | `text`          |     | nvarchar(20)    |
| 31  | `from_production_bin_code`       | `text`          |     | nvarchar(20)    |
| 32  | `adjustment_bin_code`            | `text`          |     | nvarchar(20)    |
| 33  | `always_create_put_away_line`    | `boolean`       |     | tinyint         |
| 34  | `always_create_pick_line`        | `boolean`       |     | tinyint         |
| 35  | `receipt_bin_code`               | `text`          |     | nvarchar(20)    |
| 36  | `shipment_bin_code`              | `text`          |     | nvarchar(20)    |
| 37  | `cross_dock_bin_code`            | `text`          |     | nvarchar(20)    |
| 38  | `license_plate_lot_tracking`     | `smallint`      |     | tinyint         |
| 39  | `pick_from_total_available_qty`  | `boolean`       |     | tinyint         |
| 40  | `use_gsf_epiration_for_replen`   | `boolean`       |     | tinyint         |
| 41  | `purchase_label_code`            | `text`          |     | nvarchar(20)    |
| 42  | `argent_output_folder`           | `text`          |     | nvarchar(200)   |
| 43  | `print_pallet_counter`           | `integer`       |     | int             |
| 44  | `pallet_label_code`              | `text`          |     | nvarchar(20)    |
| 45  | `general_pk`                     | `text`          |     | nvarchar(10)    |
| 46  | `bulk_pick`                      | `decimal`       |     | decimal         |
| 47  | `position_cost`                  | `integer`       |     | int             |
| 48  | `aisle_side_cost`                | `integer`       |     | int             |
| 49  | `height_cost`                    | `integer`       |     | int             |
| 50  | `change_aisle_cost`              | `integer`       |     | int             |
| 51  | `no_of_aisles_to_search`         | `integer`       |     | int             |
| 52  | `xml_export_path`                | `text`          |     | nvarchar(250)   |
| 53  | `update_pick_logic`              | `integer`       |     | int             |
| 54  | `route_closing_action`           | `integer`       |     | int             |
| 55  | `asc_order_lock_enabled`         | `boolean`       |     | tinyint         |
| 56  | `pallet_replenishment`           | `smallint`      |     | tinyint         |
| 57  | `ignore_min_qty_in_replenish`    | `smallint`      |     | tinyint         |
| 58  | `print_auto_put_away`            | `boolean`       |     | tinyint         |
| 59  | `xml_printers`                   | `integer`       |     | int             |
| 60  | `last_xml_printer_number`        | `integer`       |     | int             |
| 61  | `route_label_stylesheet`         | `text`          |     | nvarchar(30)    |
| 62  | `batch_label_stylesheet`         | `text`          |     | nvarchar(30)    |
| 63  | `batch_summary_label_stylesheet` | `text`          |     | nvarchar(30)    |
| 64  | `aisle_warning_label_stylesheet` | `text`          |     | nvarchar(30)    |
| 65  | `bulk_pick_label_stylesheet`     | `text`          |     | nvarchar(30)    |
| 66  | `bulk_pick_return_stylesheet`    | `text`          |     | nvarchar(30)    |
| 67  | `item_label_stylesheet`          | `text`          |     | nvarchar(30)    |
| 68  | `catch_weight_label_stylesheet`  | `text`          |     | nvarchar(30)    |
| 69  | `pallet_label_stylesheet`        | `text`          |     | nvarchar(30)    |
| 70  | `unique_label_nos`               | `text`          |     | nvarchar(10)    |
| 71  | `pallet_layer_height`            | `decimal`       |     | decimal         |
| 72  | `wait_period_rec_worksh_mins`    | `integer`       |     | int             |
| 73  | `aisle_code_length`              | `integer`       |     | int             |
| 74  | `pass_counter`                   | `integer`       |     | int             |
| 75  | `no_fixed_bin_setup_code`        | `text`          |     | nvarchar(10)    |
| 76  | `receive_label_format`           | `text`          |     | nvarchar(30)    |
| 77  | `receive_label_jobname`          | `text`          |     | nvarchar(30)    |
| 78  | `receive_label_printnumber`      | `integer`       |     | int             |
| 79  | `receive_label_quantity`         | `integer`       |     | int             |
| 80  | `po_label_format`                | `text`          |     | nvarchar(30)    |
| 81  | `po_label_jobname`               | `text`          |     | nvarchar(30)    |
| 82  | `po_label_printnumber`           | `integer`       |     | int             |
| 83  | `po_label_quantity`              | `integer`       |     | int             |
| 84  | `allow_empty_at_split_pallet`    | `boolean`       |     | tinyint         |
| 85  | `repack_item_jnl_template`       | `text`          |     | nvarchar(20)    |
| 86  | `repack_item_jnl_batch`          | `text`          |     | nvarchar(20)    |
| 87  | `show_replen_worksheet`          | `boolean`       |     | tinyint         |
| 88  | `show_preview_for_bread_report`  | `boolean`       |     | tinyint         |
| 89  | `show_nav_receipt_posting_error` | `boolean`       |     | tinyint         |
| 90  | `do_not_print_purchase_labels`   | `boolean`       |     | tinyint         |
| 91  | `do_not_print_pick_labels`       | `boolean`       |     | tinyint         |
| 92  | `put_away_test_mode`             | `boolean`       |     | tinyint         |
| 93  | `whse_rcpt_per_pallet`           | `smallint`      |     | tinyint         |
| 94  | `use_assumed_receipt`            | `boolean`       |     | tinyint         |
| 95  | `replenishment_source_bin_type`  | `text`          |     | nvarchar(10)    |
| 96  | `bread_bin`                      | `text`          |     | nvarchar(20)    |
| 97  | `qa_hold_code`                   | `text`          |     | nvarchar(20)    |
| 98  | `no_pick_bin_code_picking`       | `text`          |     | nvarchar(20)    |
| 99  | `create_dummy_pick_bin_setup`    | `boolean`       |     | tinyint         |
| 100 | `delete_emplty_batch_labels`     | `smallint`      |     | tinyint         |
| 101 | `default_dimension`              | `text`          |     | nvarchar(20)    |
| 102 | `max_bin_nearby_check`           | `integer`       |     | int             |
| 103 | `physical_inventory_manager`     | `text`          |     | nvarchar(50)    |
| 104 | `max_labels_for_item`            | `integer`       |     | int             |
| 105 | `pick_from_reserve`              | `integer`       |     | int             |
| 106 | `invoice_printer`                | `text`          |     | nvarchar(50)    |
| 107 | `use_locking`                    | `boolean`       |     | tinyint         |
| 108 | `registering_user`               | `text`          |     | nvarchar(50)    |
| 109 | `invoicing_user`                 | `text`          |     | nvarchar(50)    |
| 110 | `picking_user`                   | `text`          |     | nvarchar(50)    |
| 111 | `po_close_email`                 | `text`          |     | nvarchar(50)    |
| 112 | `allow_negative_bin_inventory`   | `boolean`       |     | tinyint         |
| 113 | `print_metric_data`              | `boolean`       |     | tinyint         |
| 114 | `bulk_label_qty`                 | `integer`       |     | int             |
| 115 | `show_label_metric_data`         | `boolean`       |     | tinyint         |
| 116 | `residential_delivery`           | `boolean`       |     | tinyint         |
| 117 | `shipping_payment_type`          | `integer`       |     | int             |
| 118 | `initial_lp_qa_status`           | `text`          |     | nvarchar(10)    |
| 119 | `create_lp_pallets_at_receive`   | `boolean`       |     | tinyint         |
| 120 | `use_license_plating`            | `boolean`       |     | tinyint         |
| 121 | `pallet_adjustment_bin`          | `text`          |     | nvarchar(20)    |
| 122 | `require_pallet_qa_record`       | `smallint`      |     | tinyint         |
| 123 | `use_fifo_pick_takes_lp`         | `boolean`       |     | tinyint         |
| 124 | `use_fifo_replen_takes_lp`       | `boolean`       |     | tinyint         |
| 125 | `strict_pallet_bins`             | `smallint`      |     | tinyint         |
| 126 | `allow_picking_from_lp`          | `boolean`       |     | tinyint         |
| 127 | `enter_catch_weight`             | `boolean`       |     | tinyint         |

### lot_no_information

**Original NAV Table:** `Lot No_ Information`  
**Columns:** 14  
**Primary Key:** `(source_db, item_no_, variant_code, lot_no_)`

| #   | Column Name          | PostgreSQL Type | PK  | Original MS SQL |
| --- | -------------------- | --------------- | --- | --------------- |
| 1   | `source_db`          | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`               | `text`          |     | nvarchar(66)    |
| 3   | `item_no_`           | `text`          | ✓   | nvarchar(20)    |
| 4   | `variant_code`       | `text`          | ✓   | nvarchar(10)    |
| 5   | `lot_no_`            | `text`          | ✓   | nvarchar(20)    |
| 6   | `description`        | `text`          |     | nvarchar(50)    |
| 7   | `test_quality`       | `integer`       |     | int             |
| 8   | `certificate_number` | `text`          |     | nvarchar(20)    |
| 9   | `blocked`            | `boolean`       |     | tinyint         |
| 10  | `initial_quantity`   | `decimal`       |     | decimal         |
| 11  | `posting_date`       | `timestamptz`   |     | datetime        |
| 12  | `disposition_no_`    | `text`          |     | nvarchar(20)    |
| 13  | `skip_storage_fees`  | `smallint`      |     | tinyint         |
| 14  | `storage_begin_date` | `timestamptz`   |     | datetime        |

### pallet_bin_content

**Original NAV Table:** `Pallet Bin Content`  
**Columns:** 28  
**Primary Key:** `(source_db, bin, location, pallet_no_, box_no_, item_no_, variant_no_, lot_no_, serial_no_, unit_of_measure)`

| #   | Column Name            | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------- | --------------- | --- | --------------- |
| 1   | `source_db`            | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                 | `text`          |     | nvarchar(66)    |
| 3   | `bin`                  | `text`          | ✓   | nvarchar(20)    |
| 4   | `location`             | `text`          | ✓   | nvarchar(10)    |
| 5   | `pallet_no_`           | `text`          | ✓   | nvarchar(20)    |
| 6   | `box_no_`              | `text`          | ✓   | nvarchar(20)    |
| 7   | `item_no_`             | `text`          | ✓   | nvarchar(20)    |
| 8   | `variant_no_`          | `text`          | ✓   | nvarchar(10)    |
| 9   | `lot_no_`              | `text`          | ✓   | nvarchar(20)    |
| 10  | `serial_no_`           | `text`          | ✓   | nvarchar(20)    |
| 11  | `unit_of_measure`      | `text`          | ✓   | nvarchar(10)    |
| 12  | `description`          | `text`          |     | nvarchar(50)    |
| 13  | `quantity_base`        | `decimal`       |     | decimal         |
| 14  | `quantity`             | `decimal`       |     | decimal         |
| 15  | `qty_per_uom`          | `decimal`       |     | decimal         |
| 16  | `expiry_date`          | `timestamptz`   |     | datetime        |
| 17  | `warranty_date`        | `timestamptz`   |     | datetime        |
| 18  | `last_handled_date`    | `timestamptz`   |     | datetime        |
| 19  | `last_handled_time`    | `timestamptz`   |     | datetime        |
| 20  | `creation_date`        | `timestamptz`   |     | datetime        |
| 21  | `creation_time`        | `timestamptz`   |     | datetime        |
| 22  | `qa_status`            | `text`          |     | nvarchar(10)    |
| 23  | `source_type`          | `integer`       |     | int             |
| 24  | `source_sub_type`      | `integer`       |     | int             |
| 25  | `source_id`            | `text`          |     | nvarchar(20)    |
| 26  | `source_reference_no_` | `integer`       |     | int             |
| 27  | `pallet_height`        | `decimal`       |     | decimal         |
| 28  | `counted`              | `boolean`       |     | tinyint         |

### pallet_movement

**Original NAV Table:** `Pallet Movement`  
**Columns:** 24  
**Primary Key:** `(source_db, entry_no_)`

| #   | Column Name               | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`               | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                    | `text`          |     | nvarchar(60)    |
| 3   | `entry_no_`               | `bigint`        | ✓   | bigint          |
| 4   | `from_bin_code`           | `text`          |     | nvarchar(20)    |
| 5   | `pallet_no_`              | `text`          |     | nvarchar(20)    |
| 6   | `line_no_`                | `integer`       |     | int             |
| 7   | `source_no_`              | `text`          |     | nvarchar(20)    |
| 8   | `transaction_no_`         | `text`          |     | nvarchar(20)    |
| 9   | `location_code`           | `text`          |     | nvarchar(20)    |
| 10  | `first_scan_date`         | `timestamptz`   |     | datetime        |
| 11  | `first_scan_time`         | `timestamptz`   |     | datetime        |
| 12  | `last_scan_date`          | `timestamptz`   |     | datetime        |
| 13  | `last_scan_time`          | `timestamptz`   |     | datetime        |
| 14  | `warehouse_employee_code` | `text`          |     | nvarchar(50)    |
| 15  | `completed`               | `boolean`       |     | tinyint         |
| 16  | `door_no_`                | `text`          |     | nvarchar(10)    |
| 17  | `to_bin_code`             | `text`          |     | nvarchar(20)    |
| 18  | `quantity`                | `decimal`       |     | decimal         |
| 19  | `type`                    | `text`          |     | nvarchar(10)    |
| 20  | `full_pallet`             | `boolean`       |     | tinyint         |
| 21  | `previous_bin_code`       | `text`          |     | nvarchar(20)    |
| 22  | `item_no_`                | `text`          |     | nvarchar(20)    |
| 23  | `cubage`                  | `decimal`       |     | decimal         |
| 24  | `weight`                  | `decimal`       |     | decimal         |

### purch_cr_memo_hdr

**Original NAV Table:** `Purch_ Cr_ Memo Hdr_`  
**Columns:** 68  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                    | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`                    | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                         | `text`          |     | nvarchar(66)    |
| 3   | `no_`                          | `text`          | ✓   | nvarchar(20)    |
| 4   | `buy_from_vendor_no_`          | `text`          |     | nvarchar(20)    |
| 5   | `pay_to_vendor_no_`            | `text`          |     | nvarchar(20)    |
| 6   | `pay_to_name`                  | `text`          |     | nvarchar(50)    |
| 7   | `pay_to_name_2`                | `text`          |     | nvarchar(50)    |
| 8   | `pay_to_address`               | `text`          |     | nvarchar(50)    |
| 9   | `pay_to_address_2`             | `text`          |     | nvarchar(50)    |
| 10  | `pay_to_city`                  | `text`          |     | nvarchar(30)    |
| 11  | `pay_to_contact`               | `text`          |     | nvarchar(50)    |
| 12  | `ship_to_code`                 | `text`          |     | nvarchar(10)    |
| 13  | `ship_to_name`                 | `text`          |     | nvarchar(50)    |
| 14  | `ship_to_name_2`               | `text`          |     | nvarchar(50)    |
| 15  | `ship_to_address`              | `text`          |     | nvarchar(50)    |
| 16  | `ship_to_address_2`            | `text`          |     | nvarchar(50)    |
| 17  | `ship_to_city`                 | `text`          |     | nvarchar(30)    |
| 18  | `ship_to_contact`              | `text`          |     | nvarchar(50)    |
| 19  | `posting_date`                 | `timestamptz`   |     | datetime        |
| 20  | `expected_receipt_date`        | `timestamptz`   |     | datetime        |
| 21  | `posting_description`          | `text`          |     | nvarchar(50)    |
| 22  | `payment_terms_code`           | `text`          |     | nvarchar(10)    |
| 23  | `due_date`                     | `timestamptz`   |     | datetime        |
| 24  | `shipment_method_code`         | `text`          |     | nvarchar(10)    |
| 25  | `location_code`                | `text`          |     | nvarchar(10)    |
| 26  | `shortcut_dimension_1_code`    | `text`          |     | nvarchar(20)    |
| 27  | `shortcut_dimension_2_code`    | `text`          |     | nvarchar(20)    |
| 28  | `vendor_posting_group`         | `text`          |     | nvarchar(20)    |
| 29  | `currency_code`                | `text`          |     | nvarchar(10)    |
| 30  | `currency_factor`              | `decimal`       |     | decimal         |
| 31  | `prices_including_vat`         | `boolean`       |     | tinyint         |
| 32  | `invoice_disc_code`            | `text`          |     | nvarchar(20)    |
| 33  | `purchaser_code`               | `text`          |     | nvarchar(20)    |
| 34  | `no_printed`                   | `integer`       |     | int             |
| 35  | `on_hold`                      | `text`          |     | nvarchar(3)     |
| 36  | `applies_to_doc_type`          | `integer`       |     | int             |
| 37  | `applies_to_doc_no_`           | `text`          |     | nvarchar(20)    |
| 38  | `bal_account_no_`              | `text`          |     | nvarchar(20)    |
| 39  | `vendor_cr_memo_no_`           | `text`          |     | nvarchar(35)    |
| 40  | `sell_to_customer_no_`         | `text`          |     | nvarchar(20)    |
| 41  | `reason_code`                  | `text`          |     | nvarchar(10)    |
| 42  | `gen_bus_posting_group`        | `text`          |     | nvarchar(20)    |
| 43  | `transaction_type`             | `text`          |     | nvarchar(10)    |
| 44  | `transport_method`             | `text`          |     | nvarchar(10)    |
| 45  | `buy_from_vendor_name`         | `text`          |     | nvarchar(50)    |
| 46  | `buy_from_vendor_name_2`       | `text`          |     | nvarchar(50)    |
| 47  | `buy_from_address`             | `text`          |     | nvarchar(50)    |
| 48  | `buy_from_address_2`           | `text`          |     | nvarchar(50)    |
| 49  | `buy_from_city`                | `text`          |     | nvarchar(30)    |
| 50  | `buy_from_contact`             | `text`          |     | nvarchar(50)    |
| 51  | `pay_to_post_code`             | `text`          |     | nvarchar(20)    |
| 52  | `pay_to_county`                | `text`          |     | nvarchar(30)    |
| 53  | `pay_to_country_region_code`   | `text`          |     | nvarchar(10)    |
| 54  | `buy_from_post_code`           | `text`          |     | nvarchar(20)    |
| 55  | `buy_from_county`              | `text`          |     | nvarchar(30)    |
| 56  | `buy_from_country_region_code` | `text`          |     | nvarchar(10)    |
| 57  | `ship_to_post_code`            | `text`          |     | nvarchar(20)    |
| 58  | `ship_to_county`               | `text`          |     | nvarchar(30)    |
| 59  | `ship_to_country_region_code`  | `text`          |     | nvarchar(10)    |
| 60  | `payment_method_code`          | `text`          |     | nvarchar(10)    |
| 61  | `source_code`                  | `text`          |     | nvarchar(10)    |
| 62  | `dimension_set_id`             | `integer`       |     | int             |
| 63  | `vendor_ledger_entry_no_`      | `integer`       |     | int             |
| 64  | `rebate_type`                  | `integer`       |     | int             |
| 65  | `rebate_start_date`            | `timestamptz`   |     | datetime        |
| 66  | `rebate_end_date`              | `timestamptz`   |     | datetime        |
| 67  | `rebate_doc_handling`          | `integer`       |     | int             |
| 68  | `co_op_code`                   | `text`          |     | nvarchar(10)    |

### purch_cr_memo_line

**Original NAV Table:** `Purch_ Cr_ Memo Line`  
**Columns:** 59  
**Primary Key:** `(source_db, document_no_, line_no_)`

| #   | Column Name                  | PostgreSQL Type | PK  | Original MS SQL |
| --- | ---------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                  | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                       | `text`          |     | nvarchar(66)    |
| 3   | `document_no_`               | `text`          | ✓   | nvarchar(20)    |
| 4   | `line_no_`                   | `integer`       | ✓   | int             |
| 5   | `buy_from_vendor_no_`        | `text`          |     | nvarchar(20)    |
| 6   | `type`                       | `integer`       |     | int             |
| 7   | `no_`                        | `text`          |     | nvarchar(20)    |
| 8   | `location_code`              | `text`          |     | nvarchar(10)    |
| 9   | `posting_group`              | `text`          |     | nvarchar(20)    |
| 10  | `expected_receipt_date`      | `timestamptz`   |     | datetime        |
| 11  | `description`                | `text`          |     | nvarchar(50)    |
| 12  | `description_2`              | `text`          |     | nvarchar(50)    |
| 13  | `unit_of_measure`            | `text`          |     | nvarchar(10)    |
| 14  | `quantity`                   | `decimal`       |     | decimal         |
| 15  | `direct_unit_cost`           | `decimal`       |     | decimal         |
| 16  | `unit_cost_lcy`              | `decimal`       |     | decimal         |
| 17  | `vat`                        | `decimal`       |     | decimal         |
| 18  | `line_discount`              | `decimal`       |     | decimal         |
| 19  | `line_discount_amount`       | `decimal`       |     | decimal         |
| 20  | `amount`                     | `decimal`       |     | decimal         |
| 21  | `amount_including_vat`       | `decimal`       |     | decimal         |
| 22  | `unit_price_lcy`             | `decimal`       |     | decimal         |
| 23  | `allow_invoice_disc`         | `boolean`       |     | tinyint         |
| 24  | `gross_weight`               | `decimal`       |     | decimal         |
| 25  | `net_weight`                 | `decimal`       |     | decimal         |
| 26  | `units_per_parcel`           | `decimal`       |     | decimal         |
| 27  | `unit_volume`                | `decimal`       |     | decimal         |
| 28  | `appl_to_item_entry`         | `integer`       |     | int             |
| 29  | `shortcut_dimension_1_code`  | `text`          |     | nvarchar(20)    |
| 30  | `shortcut_dimension_2_code`  | `text`          |     | nvarchar(20)    |
| 31  | `pay_to_vendor_no_`          | `text`          |     | nvarchar(20)    |
| 32  | `inv_discount_amount`        | `decimal`       |     | decimal         |
| 33  | `vendor_item_no_`            | `text`          |     | nvarchar(20)    |
| 34  | `gen_bus_posting_group`      | `text`          |     | nvarchar(20)    |
| 35  | `gen_prod_posting_group`     | `text`          |     | nvarchar(20)    |
| 36  | `transaction_type`           | `text`          |     | nvarchar(10)    |
| 37  | `tax_area_code`              | `text`          |     | nvarchar(20)    |
| 38  | `tax_liable`                 | `boolean`       |     | tinyint         |
| 39  | `tax_group_code`             | `text`          |     | nvarchar(20)    |
| 40  | `unit_cost`                  | `decimal`       |     | decimal         |
| 41  | `line_amount`                | `decimal`       |     | decimal         |
| 42  | `posting_date`               | `timestamptz`   |     | datetime        |
| 43  | `dimension_set_id`           | `integer`       |     | int             |
| 44  | `variant_code`               | `text`          |     | nvarchar(10)    |
| 45  | `bin_code`                   | `text`          |     | nvarchar(20)    |
| 46  | `qty_per_unit_of_measure`    | `decimal`       |     | decimal         |
| 47  | `unit_of_measure_code`       | `text`          |     | nvarchar(10)    |
| 48  | `quantity_base`              | `decimal`       |     | decimal         |
| 49  | `item_category_code`         | `text`          |     | nvarchar(20)    |
| 50  | `nonstock`                   | `boolean`       |     | tinyint         |
| 51  | `purchasing_code`            | `text`          |     | nvarchar(10)    |
| 52  | `product_group_code`         | `text`          |     | nvarchar(10)    |
| 53  | `rebate_type`                | `integer`       |     | int             |
| 54  | `rebate_source_doc_type`     | `integer`       |     | int             |
| 55  | `rebate_source_doc_no_`      | `text`          |     | nvarchar(20)    |
| 56  | `rebate_source_doc_line_no_` | `integer`       |     | int             |
| 57  | `cmdty_value_per_lb`         | `decimal`       |     | decimal         |
| 58  | `pounds`                     | `decimal`       |     | decimal         |
| 59  | `cost_per_pound`             | `decimal`       |     | decimal         |

### purch_inv_header

**Original NAV Table:** `Purch_ Inv_ Header`  
**Columns:** 93  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL  |
| --- | ------------------------------- | --------------- | --- | ---------------- |
| 1   | `source_db`                     | `text`          | ✓   | nvarchar(20)     |
| 2   | `hash`                          | `text`          |     | nvarchar(66)     |
| 3   | `no_`                           | `text`          | ✓   | nvarchar(20)     |
| 4   | `buy_from_vendor_no_`           | `text`          |     | nvarchar(20)     |
| 5   | `pay_to_vendor_no_`             | `text`          |     | nvarchar(20)     |
| 6   | `pay_to_name`                   | `text`          |     | nvarchar(50)     |
| 7   | `pay_to_address`                | `text`          |     | nvarchar(50)     |
| 8   | `pay_to_address_2`              | `text`          |     | nvarchar(50)     |
| 9   | `pay_to_city`                   | `text`          |     | nvarchar(30)     |
| 10  | `pay_to_contact`                | `text`          |     | nvarchar(50)     |
| 11  | `your_reference`                | `text`          |     | nvarchar(35)     |
| 12  | `ship_to_name`                  | `text`          |     | nvarchar(50)     |
| 13  | `ship_to_address`               | `text`          |     | nvarchar(50)     |
| 14  | `ship_to_address_2`             | `text`          |     | nvarchar(50)     |
| 15  | `ship_to_city`                  | `text`          |     | nvarchar(30)     |
| 16  | `ship_to_contact`               | `text`          |     | nvarchar(50)     |
| 17  | `order_date`                    | `timestamptz`   |     | datetime         |
| 18  | `posting_date`                  | `timestamptz`   |     | datetime         |
| 19  | `expected_receipt_date`         | `timestamptz`   |     | datetime         |
| 20  | `posting_description`           | `text`          |     | nvarchar(50)     |
| 21  | `payment_terms_code`            | `text`          |     | nvarchar(10)     |
| 22  | `due_date`                      | `timestamptz`   |     | datetime         |
| 23  | `payment_discount`              | `decimal`       |     | decimal          |
| 24  | `pmt_discount_date`             | `timestamptz`   |     | datetime         |
| 25  | `shipment_method_code`          | `text`          |     | nvarchar(10)     |
| 26  | `location_code`                 | `text`          |     | nvarchar(10)     |
| 27  | `shortcut_dimension_1_code`     | `text`          |     | nvarchar(20)     |
| 28  | `shortcut_dimension_2_code`     | `text`          |     | nvarchar(20)     |
| 29  | `vendor_posting_group`          | `text`          |     | nvarchar(20)     |
| 30  | `invoice_disc_code`             | `text`          |     | nvarchar(20)     |
| 31  | `language_code`                 | `text`          |     | nvarchar(10)     |
| 32  | `purchaser_code`                | `text`          |     | nvarchar(20)     |
| 33  | `order_no_`                     | `text`          |     | nvarchar(20)     |
| 34  | `no_printed`                    | `integer`       |     | int              |
| 35  | `on_hold`                       | `text`          |     | nvarchar(3)      |
| 36  | `applies_to_doc_type`           | `integer`       |     | int              |
| 37  | `applies_to_doc_no_`            | `text`          |     | nvarchar(20)     |
| 38  | `bal_account_no_`               | `text`          |     | nvarchar(20)     |
| 39  | `vendor_order_no_`              | `text`          |     | nvarchar(35)     |
| 40  | `vendor_invoice_no_`            | `text`          |     | nvarchar(35)     |
| 41  | `vat_registration_no_`          | `text`          |     | nvarchar(20)     |
| 42  | `sell_to_customer_no_`          | `text`          |     | nvarchar(20)     |
| 43  | `gen_bus_posting_group`         | `text`          |     | nvarchar(20)     |
| 44  | `vat_country_region_code`       | `text`          |     | nvarchar(10)     |
| 45  | `buy_from_vendor_name`          | `text`          |     | nvarchar(50)     |
| 46  | `buy_from_address`              | `text`          |     | nvarchar(50)     |
| 47  | `buy_from_address_2`            | `text`          |     | nvarchar(50)     |
| 48  | `buy_from_city`                 | `text`          |     | nvarchar(30)     |
| 49  | `buy_from_contact`              | `text`          |     | nvarchar(50)     |
| 50  | `pay_to_post_code`              | `text`          |     | nvarchar(20)     |
| 51  | `pay_to_county`                 | `text`          |     | nvarchar(30)     |
| 52  | `pay_to_country_region_code`    | `text`          |     | nvarchar(10)     |
| 53  | `buy_from_post_code`            | `text`          |     | nvarchar(20)     |
| 54  | `buy_from_county`               | `text`          |     | nvarchar(30)     |
| 55  | `buy_from_country_region_code`  | `text`          |     | nvarchar(10)     |
| 56  | `ship_to_post_code`             | `text`          |     | nvarchar(20)     |
| 57  | `ship_to_county`                | `text`          |     | nvarchar(30)     |
| 58  | `ship_to_country_region_code`   | `text`          |     | nvarchar(10)     |
| 59  | `order_address_code`            | `text`          |     | nvarchar(10)     |
| 60  | `document_date`                 | `timestamptz`   |     | datetime         |
| 61  | `payment_method_code`           | `text`          |     | nvarchar(10)     |
| 62  | `pre_assigned_no_series`        | `text`          |     | nvarchar(20)     |
| 63  | `no_series`                     | `text`          |     | nvarchar(20)     |
| 64  | `order_no_series`               | `text`          |     | nvarchar(20)     |
| 65  | `pre_assigned_no_`              | `text`          |     | nvarchar(20)     |
| 66  | `user_id`                       | `text`          |     | nvarchar(50)     |
| 67  | `source_code`                   | `text`          |     | nvarchar(10)     |
| 68  | `prepayment_no_series`          | `text`          |     | nvarchar(20)     |
| 69  | `prepayment_invoice`            | `boolean`       |     | tinyint          |
| 70  | `prepayment_order_no_`          | `text`          |     | nvarchar(20)     |
| 71  | `dimension_set_id`              | `integer`       |     | int              |
| 72  | `vendor_ledger_entry_no_`       | `integer`       |     | int              |
| 73  | `buy_from_contact_no_`          | `text`          |     | nvarchar(20)     |
| 74  | `pay_to_contact_no_`            | `text`          |     | nvarchar(20)     |
| 75  | `id`                            | `uuid`          |     | uniqueidentifier |
| 76  | `irs_1099_code`                 | `text`          |     | nvarchar(10)     |
| 77  | `storage_customer`              | `text`          |     | nvarchar(20)     |
| 78  | `rebate_start_date`             | `timestamptz`   |     | datetime         |
| 79  | `rebate_end_date`               | `timestamptz`   |     | datetime         |
| 80  | `disposition_no_`               | `text`          |     | nvarchar(20)     |
| 81  | `offering_no_`                  | `text`          |     | nvarchar(20)     |
| 82  | `co_op_code`                    | `text`          |     | nvarchar(10)     |
| 83  | `drop_ship_so_no_`              | `text`          |     | nvarchar(10)     |
| 84  | `edi_order`                     | `boolean`       |     | tinyint          |
| 85  | `edi_internal_doc_no_`          | `text`          |     | nvarchar(10)     |
| 86  | `edi_po_generated`              | `boolean`       |     | tinyint          |
| 87  | `edi_po_gen_date`               | `timestamptz`   |     | datetime         |
| 88  | `edi_ship_adv_gen`              | `boolean`       |     | tinyint          |
| 89  | `edi_ship_adv_gen_date`         | `timestamptz`   |     | datetime         |
| 90  | `edi_trade_partner`             | `text`          |     | nvarchar(20)     |
| 91  | `edi_buy_from_code`             | `text`          |     | nvarchar(20)     |
| 92  | `e_mail_invoice_notice_handled` | `boolean`       |     | tinyint          |
| 93  | `usda_po_no_`                   | `text`          |     | nvarchar(20)     |

### purch_inv_line

**Original NAV Table:** `Purch_ Inv_ Line`  
**Columns:** 59  
**Primary Key:** `(source_db, document_no_, line_no_)`

| #   | Column Name                 | PostgreSQL Type | PK  | Original MS SQL |
| --- | --------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                 | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                      | `text`          |     | nvarchar(66)    |
| 3   | `document_no_`              | `text`          | ✓   | nvarchar(20)    |
| 4   | `line_no_`                  | `integer`       | ✓   | int             |
| 5   | `buy_from_vendor_no_`       | `text`          |     | nvarchar(20)    |
| 6   | `type`                      | `integer`       |     | int             |
| 7   | `no_`                       | `text`          |     | nvarchar(20)    |
| 8   | `location_code`             | `text`          |     | nvarchar(10)    |
| 9   | `posting_group`             | `text`          |     | nvarchar(20)    |
| 10  | `expected_receipt_date`     | `timestamptz`   |     | datetime        |
| 11  | `description`               | `text`          |     | nvarchar(50)    |
| 12  | `description_2`             | `text`          |     | nvarchar(50)    |
| 13  | `unit_of_measure`           | `text`          |     | nvarchar(10)    |
| 14  | `quantity`                  | `decimal`       |     | decimal         |
| 15  | `direct_unit_cost`          | `decimal`       |     | decimal         |
| 16  | `unit_cost_lcy`             | `decimal`       |     | decimal         |
| 17  | `amount`                    | `decimal`       |     | decimal         |
| 18  | `amount_including_vat`      | `decimal`       |     | decimal         |
| 19  | `unit_price_lcy`            | `decimal`       |     | decimal         |
| 20  | `allow_invoice_disc`        | `boolean`       |     | tinyint         |
| 21  | `gross_weight`              | `decimal`       |     | decimal         |
| 22  | `net_weight`                | `decimal`       |     | decimal         |
| 23  | `units_per_parcel`          | `decimal`       |     | decimal         |
| 24  | `unit_volume`               | `decimal`       |     | decimal         |
| 25  | `shortcut_dimension_1_code` | `text`          |     | nvarchar(20)    |
| 26  | `shortcut_dimension_2_code` | `text`          |     | nvarchar(20)    |
| 27  | `pay_to_vendor_no_`         | `text`          |     | nvarchar(20)    |
| 28  | `vendor_item_no_`           | `text`          |     | nvarchar(20)    |
| 29  | `gen_bus_posting_group`     | `text`          |     | nvarchar(20)    |
| 30  | `gen_prod_posting_group`    | `text`          |     | nvarchar(20)    |
| 31  | `vat_calculation_type`      | `integer`       |     | int             |
| 32  | `tax_group_code`            | `text`          |     | nvarchar(20)    |
| 33  | `vat_base_amount`           | `decimal`       |     | decimal         |
| 34  | `unit_cost`                 | `decimal`       |     | decimal         |
| 35  | `line_amount`               | `decimal`       |     | decimal         |
| 36  | `ic_partner_code`           | `text`          |     | nvarchar(20)    |
| 37  | `posting_date`              | `timestamptz`   |     | datetime        |
| 38  | `dimension_set_id`          | `integer`       |     | int             |
| 39  | `variant_code`              | `text`          |     | nvarchar(10)    |
| 40  | `bin_code`                  | `text`          |     | nvarchar(20)    |
| 41  | `qty_per_unit_of_measure`   | `decimal`       |     | decimal         |
| 42  | `unit_of_measure_code`      | `text`          |     | nvarchar(10)    |
| 43  | `quantity_base`             | `decimal`       |     | decimal         |
| 44  | `item_category_code`        | `text`          |     | nvarchar(20)    |
| 45  | `product_group_code`        | `text`          |     | nvarchar(10)    |
| 46  | `irs_1099_liable`           | `smallint`      |     | tinyint         |
| 47  | `cmdty_value_per_lb`        | `decimal`       |     | decimal         |
| 48  | `pounds`                    | `decimal`       |     | decimal         |
| 49  | `cost_per_pound`            | `decimal`       |     | decimal         |
| 50  | `shipping_charge`           | `boolean`       |     | tinyint         |
| 51  | `over_receive`              | `boolean`       |     | tinyint         |
| 52  | `over_receive_verified`     | `boolean`       |     | tinyint         |
| 53  | `routing_no_`               | `text`          |     | nvarchar(20)    |
| 54  | `operation_no_`             | `text`          |     | nvarchar(10)    |
| 55  | `work_center_no_`           | `text`          |     | nvarchar(20)    |
| 56  | `prod_order_line_no_`       | `integer`       |     | int             |
| 57  | `overhead_rate`             | `decimal`       |     | decimal         |
| 58  | `routing_reference_no_`     | `integer`       |     | int             |
| 59  | `appl_to_order_no_`         | `text`          |     | nvarchar(20)    |

### purch_rcpt_header

**Original NAV Table:** `Purch_ Rcpt_ Header`  
**Columns:** 72  
**Primary Key:** `(source_db, no_)`

| #   | Column Name                    | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------ | --------------- | --- | --------------- |
| 1   | `source_db`                    | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                         | `text`          |     | nvarchar(66)    |
| 3   | `no_`                          | `text`          | ✓   | nvarchar(20)    |
| 4   | `buy_from_vendor_no_`          | `text`          |     | nvarchar(20)    |
| 5   | `pay_to_vendor_no_`            | `text`          |     | nvarchar(20)    |
| 6   | `pay_to_name`                  | `text`          |     | nvarchar(50)    |
| 7   | `pay_to_name_2`                | `text`          |     | nvarchar(50)    |
| 8   | `pay_to_address`               | `text`          |     | nvarchar(50)    |
| 9   | `pay_to_address_2`             | `text`          |     | nvarchar(50)    |
| 10  | `pay_to_city`                  | `text`          |     | nvarchar(30)    |
| 11  | `pay_to_contact`               | `text`          |     | nvarchar(50)    |
| 12  | `your_reference`               | `text`          |     | nvarchar(35)    |
| 13  | `ship_to_code`                 | `text`          |     | nvarchar(10)    |
| 14  | `ship_to_name`                 | `text`          |     | nvarchar(50)    |
| 15  | `ship_to_name_2`               | `text`          |     | nvarchar(50)    |
| 16  | `ship_to_address`              | `text`          |     | nvarchar(50)    |
| 17  | `ship_to_address_2`            | `text`          |     | nvarchar(50)    |
| 18  | `ship_to_city`                 | `text`          |     | nvarchar(30)    |
| 19  | `ship_to_contact`              | `text`          |     | nvarchar(50)    |
| 20  | `order_date`                   | `timestamptz`   |     | datetime        |
| 21  | `posting_date`                 | `timestamptz`   |     | datetime        |
| 22  | `expected_receipt_date`        | `timestamptz`   |     | datetime        |
| 23  | `posting_description`          | `text`          |     | nvarchar(50)    |
| 24  | `payment_terms_code`           | `text`          |     | nvarchar(10)    |
| 25  | `due_date`                     | `timestamptz`   |     | datetime        |
| 26  | `payment_discount`             | `decimal`       |     | decimal         |
| 27  | `pmt_discount_date`            | `timestamptz`   |     | datetime        |
| 28  | `shipment_method_code`         | `text`          |     | nvarchar(10)    |
| 29  | `location_code`                | `text`          |     | nvarchar(10)    |
| 30  | `shortcut_dimension_1_code`    | `text`          |     | nvarchar(20)    |
| 31  | `shortcut_dimension_2_code`    | `text`          |     | nvarchar(20)    |
| 32  | `vendor_posting_group`         | `text`          |     | nvarchar(20)    |
| 33  | `invoice_disc_code`            | `text`          |     | nvarchar(20)    |
| 34  | `purchaser_code`               | `text`          |     | nvarchar(20)    |
| 35  | `order_no_`                    | `text`          |     | nvarchar(20)    |
| 36  | `vendor_order_no_`             | `text`          |     | nvarchar(35)    |
| 37  | `vendor_shipment_no_`          | `text`          |     | nvarchar(35)    |
| 38  | `sell_to_customer_no_`         | `text`          |     | nvarchar(20)    |
| 39  | `reason_code`                  | `text`          |     | nvarchar(10)    |
| 40  | `gen_bus_posting_group`        | `text`          |     | nvarchar(20)    |
| 41  | `vat_country_region_code`      | `text`          |     | nvarchar(10)    |
| 42  | `buy_from_vendor_name`         | `text`          |     | nvarchar(50)    |
| 43  | `buy_from_vendor_name_2`       | `text`          |     | nvarchar(50)    |
| 44  | `buy_from_address`             | `text`          |     | nvarchar(50)    |
| 45  | `buy_from_address_2`           | `text`          |     | nvarchar(50)    |
| 46  | `buy_from_city`                | `text`          |     | nvarchar(30)    |
| 47  | `buy_from_contact`             | `text`          |     | nvarchar(50)    |
| 48  | `pay_to_post_code`             | `text`          |     | nvarchar(20)    |
| 49  | `pay_to_county`                | `text`          |     | nvarchar(30)    |
| 50  | `pay_to_country_region_code`   | `text`          |     | nvarchar(10)    |
| 51  | `buy_from_post_code`           | `text`          |     | nvarchar(20)    |
| 52  | `buy_from_county`              | `text`          |     | nvarchar(30)    |
| 53  | `buy_from_country_region_code` | `text`          |     | nvarchar(10)    |
| 54  | `ship_to_post_code`            | `text`          |     | nvarchar(20)    |
| 55  | `ship_to_county`               | `text`          |     | nvarchar(30)    |
| 56  | `ship_to_country_region_code`  | `text`          |     | nvarchar(10)    |
| 57  | `correction`                   | `boolean`       |     | tinyint         |
| 58  | `document_date`                | `timestamptz`   |     | datetime        |
| 59  | `payment_method_code`          | `text`          |     | nvarchar(10)    |
| 60  | `no_series`                    | `text`          |     | nvarchar(20)    |
| 61  | `order_no_series`              | `text`          |     | nvarchar(20)    |
| 62  | `user_id`                      | `text`          |     | nvarchar(50)    |
| 63  | `source_code`                  | `text`          |     | nvarchar(10)    |
| 64  | `dimension_set_id`             | `integer`       |     | int             |
| 65  | `buy_from_contact_no_`         | `text`          |     | nvarchar(20)    |
| 66  | `pay_to_contact_no_`           | `text`          |     | nvarchar(20)    |
| 67  | `lead_time_calculation`        | `varchar(32)`   |     | varchar(32)     |
| 68  | `disposition_no_`              | `text`          |     | nvarchar(20)    |
| 69  | `offering_no_`                 | `text`          |     | nvarchar(20)    |
| 70  | `co_op_code`                   | `text`          |     | nvarchar(10)    |
| 71  | `freight_vendor`               | `text`          |     | nvarchar(20)    |
| 72  | `freight_amount`               | `decimal`       |     | decimal         |

### purch_rcpt_line

**Original NAV Table:** `Purch_ Rcpt_ Line`  
**Columns:** 74  
**Primary Key:** `(source_db, document_no_, line_no_)`

| #   | Column Name                     | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------------------- | --------------- | --- | --------------- |
| 1   | `source_db`                     | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`                          | `text`          |     | nvarchar(66)    |
| 3   | `document_no_`                  | `text`          | ✓   | nvarchar(20)    |
| 4   | `line_no_`                      | `integer`       | ✓   | int             |
| 5   | `buy_from_vendor_no_`           | `text`          |     | nvarchar(20)    |
| 6   | `type`                          | `integer`       |     | int             |
| 7   | `no_`                           | `text`          |     | nvarchar(20)    |
| 8   | `location_code`                 | `text`          |     | nvarchar(10)    |
| 9   | `posting_group`                 | `text`          |     | nvarchar(20)    |
| 10  | `expected_receipt_date`         | `timestamptz`   |     | datetime        |
| 11  | `description`                   | `text`          |     | nvarchar(50)    |
| 12  | `description_2`                 | `text`          |     | nvarchar(50)    |
| 13  | `unit_of_measure`               | `text`          |     | nvarchar(10)    |
| 14  | `quantity`                      | `decimal`       |     | decimal         |
| 15  | `direct_unit_cost`              | `decimal`       |     | decimal         |
| 16  | `unit_cost_lcy`                 | `decimal`       |     | decimal         |
| 17  | `line_discount`                 | `decimal`       |     | decimal         |
| 18  | `unit_price_lcy`                | `decimal`       |     | decimal         |
| 19  | `allow_invoice_disc`            | `boolean`       |     | tinyint         |
| 20  | `gross_weight`                  | `decimal`       |     | decimal         |
| 21  | `net_weight`                    | `decimal`       |     | decimal         |
| 22  | `units_per_parcel`              | `decimal`       |     | decimal         |
| 23  | `unit_volume`                   | `decimal`       |     | decimal         |
| 24  | `appl_to_item_entry`            | `integer`       |     | int             |
| 25  | `item_rcpt_entry_no_`           | `integer`       |     | int             |
| 26  | `shortcut_dimension_1_code`     | `text`          |     | nvarchar(20)    |
| 27  | `shortcut_dimension_2_code`     | `text`          |     | nvarchar(20)    |
| 28  | `indirect_cost`                 | `decimal`       |     | decimal         |
| 29  | `qty_rcd_not_invoiced`          | `decimal`       |     | decimal         |
| 30  | `quantity_invoiced`             | `decimal`       |     | decimal         |
| 31  | `order_no_`                     | `text`          |     | nvarchar(20)    |
| 32  | `order_line_no_`                | `integer`       |     | int             |
| 33  | `pay_to_vendor_no_`             | `text`          |     | nvarchar(20)    |
| 34  | `vendor_item_no_`               | `text`          |     | nvarchar(20)    |
| 35  | `sales_order_no_`               | `text`          |     | nvarchar(20)    |
| 36  | `sales_order_line_no_`          | `integer`       |     | int             |
| 37  | `gen_bus_posting_group`         | `text`          |     | nvarchar(20)    |
| 38  | `gen_prod_posting_group`        | `text`          |     | nvarchar(20)    |
| 39  | `vat_calculation_type`          | `integer`       |     | int             |
| 40  | `unit_cost`                     | `decimal`       |     | decimal         |
| 41  | `posting_date`                  | `timestamptz`   |     | datetime        |
| 42  | `dimension_set_id`              | `integer`       |     | int             |
| 43  | `prod_order_no_`                | `text`          |     | nvarchar(20)    |
| 44  | `variant_code`                  | `text`          |     | nvarchar(10)    |
| 45  | `bin_code`                      | `text`          |     | nvarchar(20)    |
| 46  | `qty_per_unit_of_measure`       | `decimal`       |     | decimal         |
| 47  | `unit_of_measure_code`          | `text`          |     | nvarchar(10)    |
| 48  | `quantity_base`                 | `decimal`       |     | decimal         |
| 49  | `qty_invoiced_base`             | `decimal`       |     | decimal         |
| 50  | `item_category_code`            | `text`          |     | nvarchar(20)    |
| 51  | `nonstock`                      | `boolean`       |     | tinyint         |
| 52  | `purchasing_code`               | `text`          |     | nvarchar(10)    |
| 53  | `product_group_code`            | `text`          |     | nvarchar(10)    |
| 54  | `special_order_sales_no_`       | `text`          |     | nvarchar(20)    |
| 55  | `special_order_sales_line_no_`  | `integer`       |     | int             |
| 56  | `requested_receipt_date`        | `timestamptz`   |     | datetime        |
| 57  | `promised_receipt_date`         | `timestamptz`   |     | datetime        |
| 58  | `lead_time_calculation`         | `varchar(32)`   |     | varchar(32)     |
| 59  | `inbound_whse_handling_time`    | `varchar(32)`   |     | varchar(32)     |
| 60  | `planned_receipt_date`          | `timestamptz`   |     | datetime        |
| 61  | `order_date`                    | `timestamptz`   |     | datetime        |
| 62  | `item_charge_base_amount`       | `decimal`       |     | decimal         |
| 63  | `correction`                    | `boolean`       |     | tinyint         |
| 64  | `return_reason_code`            | `text`          |     | nvarchar(10)    |
| 65  | `cmdty_value_per_lb`            | `decimal`       |     | decimal         |
| 66  | `pounds`                        | `decimal`       |     | decimal         |
| 67  | `cost_per_pound`                | `decimal`       |     | decimal         |
| 68  | `shipping_charge`               | `boolean`       |     | tinyint         |
| 69  | `over_receive`                  | `boolean`       |     | tinyint         |
| 70  | `over_receive_verified`         | `boolean`       |     | tinyint         |
| 71  | `routing_no_`                   | `text`          |     | nvarchar(20)    |
| 72  | `overhead_rate`                 | `decimal`       |     | decimal         |
| 73  | `routing_reference_no_`         | `integer`       |     | int             |
| 74  | `city_state_zip_code_of_origin` | `text`          |     | nvarchar(50)    |

### purchase_header

**Original NAV Table:** `Purchase Header`  
**Columns:** 147  
**Primary Key:** `(source_db, document_type, no_)`

| #   | Column Name                    | PostgreSQL Type | PK  | Original MS SQL  |
| --- | ------------------------------ | --------------- | --- | ---------------- |
| 1   | `source_db`                    | `text`          | ✓   | nvarchar(20)     |
| 2   | `hash`                         | `text`          |     | nvarchar(66)     |
| 3   | `document_type`                | `integer`       | ✓   | int              |
| 4   | `no_`                          | `text`          | ✓   | nvarchar(20)     |
| 5   | `buy_from_vendor_no_`          | `text`          |     | nvarchar(20)     |
| 6   | `pay_to_vendor_no_`            | `text`          |     | nvarchar(20)     |
| 7   | `pay_to_name`                  | `text`          |     | nvarchar(50)     |
| 8   | `pay_to_address`               | `text`          |     | nvarchar(50)     |
| 9   | `pay_to_address_2`             | `text`          |     | nvarchar(50)     |
| 10  | `pay_to_city`                  | `text`          |     | nvarchar(30)     |
| 11  | `pay_to_contact`               | `text`          |     | nvarchar(50)     |
| 12  | `your_reference`               | `text`          |     | nvarchar(35)     |
| 13  | `ship_to_name`                 | `text`          |     | nvarchar(50)     |
| 14  | `ship_to_address`              | `text`          |     | nvarchar(50)     |
| 15  | `ship_to_address_2`            | `text`          |     | nvarchar(50)     |
| 16  | `ship_to_city`                 | `text`          |     | nvarchar(30)     |
| 17  | `ship_to_contact`              | `text`          |     | nvarchar(50)     |
| 18  | `order_date`                   | `timestamptz`   |     | datetime         |
| 19  | `posting_date`                 | `timestamptz`   |     | datetime         |
| 20  | `expected_receipt_date`        | `timestamptz`   |     | datetime         |
| 21  | `posting_description`          | `text`          |     | nvarchar(50)     |
| 22  | `payment_terms_code`           | `text`          |     | nvarchar(10)     |
| 23  | `due_date`                     | `timestamptz`   |     | datetime         |
| 24  | `payment_discount`             | `decimal`       |     | decimal          |
| 25  | `pmt_discount_date`            | `timestamptz`   |     | datetime         |
| 26  | `shipment_method_code`         | `text`          |     | nvarchar(10)     |
| 27  | `location_code`                | `text`          |     | nvarchar(10)     |
| 28  | `shortcut_dimension_1_code`    | `text`          |     | nvarchar(20)     |
| 29  | `shortcut_dimension_2_code`    | `text`          |     | nvarchar(20)     |
| 30  | `vendor_posting_group`         | `text`          |     | nvarchar(20)     |
| 31  | `invoice_disc_code`            | `text`          |     | nvarchar(20)     |
| 32  | `language_code`                | `text`          |     | nvarchar(10)     |
| 33  | `purchaser_code`               | `text`          |     | nvarchar(20)     |
| 34  | `order_class`                  | `text`          |     | nvarchar(10)     |
| 35  | `no_printed`                   | `integer`       |     | int              |
| 36  | `on_hold`                      | `text`          |     | nvarchar(3)      |
| 37  | `applies_to_doc_type`          | `integer`       |     | int              |
| 38  | `applies_to_doc_no_`           | `text`          |     | nvarchar(20)     |
| 39  | `bal_account_no_`              | `text`          |     | nvarchar(20)     |
| 40  | `receive`                      | `boolean`       |     | tinyint          |
| 41  | `invoice`                      | `boolean`       |     | tinyint          |
| 42  | `print_posted_documents`       | `boolean`       |     | tinyint          |
| 43  | `receiving_no_`                | `text`          |     | nvarchar(20)     |
| 44  | `posting_no_`                  | `text`          |     | nvarchar(20)     |
| 45  | `last_receiving_no_`           | `text`          |     | nvarchar(20)     |
| 46  | `last_posting_no_`             | `text`          |     | nvarchar(20)     |
| 47  | `vendor_order_no_`             | `text`          |     | nvarchar(35)     |
| 48  | `vendor_shipment_no_`          | `text`          |     | nvarchar(35)     |
| 49  | `vendor_invoice_no_`           | `text`          |     | nvarchar(35)     |
| 50  | `vendor_cr_memo_no_`           | `text`          |     | nvarchar(35)     |
| 51  | `vat_registration_no_`         | `text`          |     | nvarchar(20)     |
| 52  | `sell_to_customer_no_`         | `text`          |     | nvarchar(20)     |
| 53  | `gen_bus_posting_group`        | `text`          |     | nvarchar(20)     |
| 54  | `vat_country_region_code`      | `text`          |     | nvarchar(10)     |
| 55  | `buy_from_vendor_name`         | `text`          |     | nvarchar(50)     |
| 56  | `buy_from_address`             | `text`          |     | nvarchar(50)     |
| 57  | `buy_from_address_2`           | `text`          |     | nvarchar(50)     |
| 58  | `buy_from_city`                | `text`          |     | nvarchar(30)     |
| 59  | `buy_from_contact`             | `text`          |     | nvarchar(50)     |
| 60  | `pay_to_post_code`             | `text`          |     | nvarchar(20)     |
| 61  | `pay_to_county`                | `text`          |     | nvarchar(30)     |
| 62  | `pay_to_country_region_code`   | `text`          |     | nvarchar(10)     |
| 63  | `buy_from_post_code`           | `text`          |     | nvarchar(20)     |
| 64  | `buy_from_county`              | `text`          |     | nvarchar(30)     |
| 65  | `buy_from_country_region_code` | `text`          |     | nvarchar(10)     |
| 66  | `ship_to_post_code`            | `text`          |     | nvarchar(20)     |
| 67  | `ship_to_county`               | `text`          |     | nvarchar(30)     |
| 68  | `ship_to_country_region_code`  | `text`          |     | nvarchar(10)     |
| 69  | `order_address_code`           | `text`          |     | nvarchar(10)     |
| 70  | `document_date`                | `timestamptz`   |     | datetime         |
| 71  | `payment_method_code`          | `text`          |     | nvarchar(10)     |
| 72  | `no_series`                    | `text`          |     | nvarchar(20)     |
| 73  | `posting_no_series`            | `text`          |     | nvarchar(20)     |
| 74  | `receiving_no_series`          | `text`          |     | nvarchar(20)     |
| 75  | `status`                       | `integer`       |     | int              |
| 76  | `invoice_discount_calculation` | `integer`       |     | int              |
| 77  | `invoice_discount_value`       | `decimal`       |     | decimal          |
| 78  | `prepayment_no_`               | `text`          |     | nvarchar(20)     |
| 79  | `last_prepayment_no_`          | `text`          |     | nvarchar(20)     |
| 80  | `prepmt_cr_memo_no_`           | `text`          |     | nvarchar(20)     |
| 81  | `last_prepmt_cr_memo_no_`      | `text`          |     | nvarchar(20)     |
| 82  | `prepayment`                   | `decimal`       |     | decimal          |
| 83  | `prepayment_no_series`         | `text`          |     | nvarchar(20)     |
| 84  | `compress_prepayment`          | `boolean`       |     | tinyint          |
| 85  | `prepayment_due_date`          | `timestamptz`   |     | datetime         |
| 86  | `prepmt_cr_memo_no_series`     | `text`          |     | nvarchar(20)     |
| 87  | `prepmt_posting_description`   | `text`          |     | nvarchar(50)     |
| 88  | `prepmt_pmt_discount_date`     | `timestamptz`   |     | datetime         |
| 89  | `prepmt_payment_terms_code`    | `text`          |     | nvarchar(10)     |
| 90  | `prepmt_payment_discount`      | `decimal`       |     | decimal          |
| 91  | `incoming_document_entry_no_`  | `integer`       |     | int              |
| 92  | `dimension_set_id`             | `integer`       |     | int              |
| 93  | `doc_no_occurrence`            | `integer`       |     | int              |
| 94  | `buy_from_contact_no_`         | `text`          |     | nvarchar(20)     |
| 95  | `pay_to_contact_no_`           | `text`          |     | nvarchar(20)     |
| 96  | `requested_receipt_date`       | `timestamptz`   |     | datetime         |
| 97  | `promised_receipt_date`        | `timestamptz`   |     | datetime         |
| 98  | `lead_time_calculation`        | `varchar(32)`   |     | varchar(32)      |
| 99  | `vendor_authorization_no_`     | `text`          |     | nvarchar(35)     |
| 100 | `return_shipment_no_series`    | `text`          |     | nvarchar(20)     |
| 101 | `ship`                         | `boolean`       |     | tinyint          |
| 102 | `last_return_shipment_no_`     | `text`          |     | nvarchar(20)     |
| 103 | `id`                           | `uuid`          |     | uniqueidentifier |
| 104 | `assigned_user_id`             | `text`          |     | nvarchar(50)     |
| 105 | `irs_1099_code`                | `text`          |     | nvarchar(10)     |
| 106 | `rebate_start_date`            | `timestamptz`   |     | datetime         |
| 107 | `rebate_end_date`              | `timestamptz`   |     | datetime         |
| 108 | `disposition_no_`              | `text`          |     | nvarchar(20)     |
| 109 | `offering_no_`                 | `text`          |     | nvarchar(20)     |
| 110 | `rebate_doc_handling`          | `integer`       |     | int              |
| 111 | `pricing_confirm`              | `text`          |     | nvarchar(30)     |
| 112 | `labels_printed`               | `boolean`       |     | tinyint          |
| 113 | `order_closed`                 | `boolean`       |     | tinyint          |
| 114 | `co_op_code`                   | `text`          |     | nvarchar(10)     |
| 115 | `include_qty_for_pick`         | `boolean`       |     | tinyint          |
| 116 | `available_date`               | `timestamptz`   |     | datetime         |
| 117 | `manual_available_date`        | `smallint`      |     | tinyint          |
| 118 | `priority`                     | `smallint`      |     | tinyint          |
| 119 | `drop_ship_so_no_`             | `text`          |     | nvarchar(10)     |
| 120 | `zone`                         | `text`          |     | nvarchar(20)     |
| 121 | `geographic_code`              | `text`          |     | nvarchar(20)     |
| 122 | `allow_order_below_minimum`    | `boolean`       |     | tinyint          |
| 123 | `edi_order`                    | `boolean`       |     | tinyint          |
| 124 | `edi_internal_doc_no_`         | `text`          |     | nvarchar(10)     |
| 125 | `edi_po_generated`             | `boolean`       |     | tinyint          |
| 126 | `edi_po_gen_date`              | `timestamptz`   |     | datetime         |
| 127 | `edi_released`                 | `boolean`       |     | tinyint          |
| 128 | `edi_ship_adv_gen`             | `boolean`       |     | tinyint          |
| 129 | `edi_ship_adv_gen_date`        | `timestamptz`   |     | datetime         |
| 130 | `edi_update_int_doc_no_`       | `text`          |     | nvarchar(10)     |
| 131 | `edi_trade_partner`            | `text`          |     | nvarchar(20)     |
| 132 | `edi_buy_from_code`            | `text`          |     | nvarchar(20)     |
| 133 | `e_ship_agent_code`            | `text`          |     | nvarchar(10)     |
| 134 | `e_ship_agent_service`         | `text`          |     | nvarchar(30)     |
| 135 | `world_wide_service`           | `boolean`       |     | tinyint          |
| 136 | `residential_delivery`         | `boolean`       |     | tinyint          |
| 137 | `cod_payment`                  | `boolean`       |     | tinyint          |
| 138 | `cod_cashiers_check`           | `smallint`      |     | tinyint          |
| 139 | `shipping_payment_type`        | `integer`       |     | int              |
| 140 | `third_party_ship_account_no_` | `text`          |     | nvarchar(20)     |
| 141 | `shipping_insurance`           | `integer`       |     | int              |
| 142 | `e_mail_confirmation_handled`  | `smallint`      |     | tinyint          |
| 143 | `show_order`                   | `boolean`       |     | tinyint          |
| 144 | `freight_vendor`               | `text`          |     | nvarchar(20)     |
| 145 | `freight_amount`               | `decimal`       |     | decimal          |
| 146 | `usda_quote_no_`               | `text`          |     | nvarchar(10)     |
| 147 | `usda_po_no_`                  | `text`          |     | nvarchar(20)     |

### completed_bid

**Original NAV Table:** `Completed Bid`
**Columns:** 7
**Primary Key:** `(source_db, sales_code, customer_bid_no)`

| #   | Column Name        | PostgreSQL Type | PK  | Original MS SQL |
| --- | ------------------ | --------------- | --- | --------------- |
| 1   | `source_db`        | `text`          | ✓   | nvarchar(20)    |
| 2   | `hash`             | `text`          |     | nvarchar(66)    |
| 3   | `sales_type`       | `integer`       |     | int             |
| 4   | `sales_code`       | `text`          | ✓   | nvarchar(20)    |
| 5   | `customer_bid_no_` | `text`          | ✓   | nvarchar(20)    |
| 6   | `data_inserted`    | `text`          |     | nvarchar(20)    |
| 7   | `user_name`        | `text`          |     | nvarchar(50)    |

---

## Indexes

### Standard Indexes (FK Columns)

All foreign key columns have B-tree indexes for join performance:

```sql
CREATE INDEX idx_tablename_column ON dw2_nav.tablename (column);
```

### GIN Indexes (Text Search)

Full-text search indexes on description/name columns:

```sql
CREATE INDEX idx_tablename_column_gin
ON dw2_nav.tablename
USING gin (to_tsvector('english', coalesce(column, '')));
```

Tables with GIN indexes:

- item (description)
- customer (name, search_name)
- contact (name, search_name)
- location (name)
- g_l_account (name, search_name)
- campaign (description)

---

## Migration Notes

### AWS DMS Considerations

1. **Source DB Column**: All tables include `source_db` as part of the composite primary key
2. **Hash Column**: Present for CDC (Change Data Capture) tracking
3. **No Foreign Keys**: FK constraints are documented but not enforced for ETL performance
4. **Timestamp Handling**: All datetime columns use `timestamptz` for timezone awareness

### Data Type Handling

1. **Boolean Conversion**: tinyint fields that represent flags are converted to boolean
2. **Decimal Precision**: No explicit precision allows PostgreSQL to handle arbitrary precision
3. **Text Storage**: All string fields use `text` (PostgreSQL optimizes internally)

### Index Strategy

1. Create indexes after initial data load for faster bulk import
2. Add custom indexes based on query patterns observed in production
3. Consider partial indexes for large tables with selective queries

---

## Files Included

| File                              | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `001_create_schema.sql`           | Complete DDL for schema, tables, and indexes |
| `gsf_nav_dw2_erd.md`              | Mermaid ERD diagram                          |
| `gsf_nav_dw2_documentation.md`    | This documentation file                      |
| `gsf_nav_dw2_claude_code_spec.md` | Specification file for Claude Code           |

---

**Author:** Bakhrom Botirov  
**Date:** 12/08/2025

_GSF AI Transformation Project_
