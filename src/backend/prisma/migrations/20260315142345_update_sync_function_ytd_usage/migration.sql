-- Update sync function to populate ytd_usage from current year sales data
-- Uses same data source as last_year_sales (ItemLedgerEntry + SalesInvoiceHeader)
-- but filtered to current school year (p_start_date to CURRENT_DATE)

CREATE OR REPLACE FUNCTION ait.sync_customer_bids(
  p_school_year   TEXT,
  p_start_date    DATE,
  p_end_date      DATE,
  p_ly_start_date DATE,
  p_ly_end_date   DATE
)
RETURNS TABLE(records_inserted INTEGER, records_updated INTEGER, records_total INTEGER, won_count INTEGER, lost_count INTEGER)
LANGUAGE plpgsql
AS $func$
DECLARE
  v_inserted  INTEGER := 0;
  v_updated   INTEGER := 0;
  v_won_count  INTEGER := 0;
  v_xmax      TEXT;
BEGIN

  -- ============================================================
  -- Upsert current year bids with is_new detection
  --
  -- is_new = TRUE  -> item is in current year but NOT in previous year
  -- is_new = FALSE -> item is in both current and previous year (renewed)
  -- ============================================================
  FOR v_xmax IN
    WITH current_year_bids AS (
      SELECT
        sp.source_db,
        c.location_code  AS site_code,
        sp.sales_code    AS customer_bill_to,
        sp.item_no_      AS item_no,
        SUM(sp.customer_bid_qty_) AS bid_qty,
        MIN(sp.starting_date)     AS bid_start,
        MAX(sp.ending_date)       AS bid_end
      FROM dw2_nav.sales_price sp
      INNER JOIN dw2_nav.customer c
        ON sp.sales_code = c.no_
        AND sp.source_db = c.source_db
      WHERE sp.starting_date >= p_start_date
        AND sp.starting_date <= p_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_
    ),
    last_year_bids AS (
      SELECT
        sp.source_db,
        c.location_code  AS site_code,
        sp.sales_code    AS customer_bill_to,
        sp.item_no_      AS item_no,
        SUM(sp.customer_bid_qty_) AS bid_qty
      FROM dw2_nav.sales_price sp
      INNER JOIN dw2_nav.customer c
        ON sp.sales_code = c.no_
        AND sp.source_db = c.source_db
      WHERE sp.starting_date >= p_ly_start_date
        AND sp.starting_date <= p_ly_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_
    ),
    last_year_sales AS (
      SELECT
        ile.source_db,
        c.location_code            AS site_code,
        sih.bill_to_customer_no_   AS customer_bill_to,
        ile.item_no_               AS item_no,
        ABS(SUM(ile.quantity))     AS total_quantity,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 8  THEN ile.quantity ELSE 0 END)) AS aug_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 9  THEN ile.quantity ELSE 0 END)) AS sep_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 10 THEN ile.quantity ELSE 0 END)) AS oct_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 11 THEN ile.quantity ELSE 0 END)) AS nov_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 12 THEN ile.quantity ELSE 0 END)) AS dec_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 1  THEN ile.quantity ELSE 0 END)) AS jan_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 2  THEN ile.quantity ELSE 0 END)) AS feb_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 3  THEN ile.quantity ELSE 0 END)) AS mar_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 4  THEN ile.quantity ELSE 0 END)) AS apr_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 5  THEN ile.quantity ELSE 0 END)) AS may_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 6  THEN ile.quantity ELSE 0 END)) AS jun_qty,
        ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 7  THEN ile.quantity ELSE 0 END)) AS jul_qty
      FROM dw2_nav.item_ledger_entry ile
      INNER JOIN dw2_nav.sales_invoice_header sih
        ON ile.document_no_ = sih.no_
        AND ile.source_db = sih.source_db
      INNER JOIN dw2_nav.customer c
        ON sih.bill_to_customer_no_ = c.no_
        AND sih.source_db = c.source_db
      WHERE ile.entry_type = 1
        AND sih.posting_date >= p_ly_start_date
        AND sih.posting_date <= p_ly_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY ile.source_db, c.location_code, sih.bill_to_customer_no_, ile.item_no_
    ),
    current_year_sales AS (
      SELECT
        ile.source_db,
        c.location_code            AS site_code,
        sih.bill_to_customer_no_   AS customer_bill_to,
        ile.item_no_               AS item_no,
        ABS(SUM(ile.quantity))     AS total_quantity
      FROM dw2_nav.item_ledger_entry ile
      INNER JOIN dw2_nav.sales_invoice_header sih
        ON ile.document_no_ = sih.no_
        AND ile.source_db = sih.source_db
      INNER JOIN dw2_nav.customer c
        ON sih.bill_to_customer_no_ = c.no_
        AND sih.source_db = c.source_db
      WHERE ile.entry_type = 1
        AND sih.posting_date >= p_start_date
        AND sih.posting_date <= LEAST(p_end_date, CURRENT_DATE)
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY ile.source_db, c.location_code, sih.bill_to_customer_no_, ile.item_no_
    ),
    relevant_items AS (
      SELECT source_db, item_no FROM current_year_bids
      UNION
      SELECT source_db, item_no FROM last_year_bids
    ),
    erp_status AS (
      SELECT DISTINCT ON (sku.item_no_, sku.source_db)
        sku.source_db,
        sku.item_no_ AS item_no,
        sku.status
      FROM dw2_nav.stockkeeping_unit sku
      INNER JOIN relevant_items ri
        ON sku.source_db = ri.source_db
        AND sku.item_no_ = ri.item_no
      ORDER BY sku.item_no_, sku.source_db, sku.last_date_modified DESC
    )
    INSERT INTO ait.customer_bid_data (
      source_db, site_code, customer_bill_to, item_no, school_year,
      bid_qty, bid_start, bid_end, erp_status,
      last_year_bid_qty, is_new, last_year_actual,
      ly_august, ly_september, ly_october, ly_november, ly_december,
      ly_january, ly_february, ly_march, ly_april, ly_may, ly_june, ly_july,
      ytd_usage,
      synced_at, updated_at
    )
    SELECT
      cb.source_db,
      cb.site_code,
      cb.customer_bill_to,
      cb.item_no,
      p_school_year,
      cb.bid_qty,
      cb.bid_start,
      cb.bid_end,
      erp.status,
      lyb.bid_qty,
      -- is_new: TRUE if item is in current year but NOT in previous year
      CASE WHEN lyb.source_db IS NULL THEN TRUE ELSE FALSE END,
      lys.total_quantity,
      lys.aug_qty, lys.sep_qty, lys.oct_qty, lys.nov_qty, lys.dec_qty,
      lys.jan_qty, lys.feb_qty, lys.mar_qty, lys.apr_qty, lys.may_qty,
      lys.jun_qty, lys.jul_qty,
      cys.total_quantity,
      NOW(),
      NOW()
    FROM current_year_bids cb
    LEFT JOIN last_year_bids lyb
      ON  cb.source_db       = lyb.source_db
      AND cb.site_code       = lyb.site_code
      AND cb.customer_bill_to = lyb.customer_bill_to
      AND cb.item_no         = lyb.item_no
    LEFT JOIN last_year_sales lys
      ON  cb.source_db       = lys.source_db
      AND cb.site_code       = lys.site_code
      AND cb.customer_bill_to = lys.customer_bill_to
      AND cb.item_no         = lys.item_no
    LEFT JOIN current_year_sales cys
      ON  cb.source_db       = cys.source_db
      AND cb.site_code       = cys.site_code
      AND cb.customer_bill_to = cys.customer_bill_to
      AND cb.item_no         = cys.item_no
    LEFT JOIN erp_status erp
      ON  cb.source_db = erp.source_db
      AND cb.item_no   = erp.item_no
    ON CONFLICT (source_db, site_code, customer_bill_to, item_no, school_year)
    DO UPDATE SET
      bid_qty           = EXCLUDED.bid_qty,
      bid_start         = EXCLUDED.bid_start,
      bid_end           = EXCLUDED.bid_end,
      erp_status        = EXCLUDED.erp_status,
      last_year_bid_qty = EXCLUDED.last_year_bid_qty,
      is_new            = EXCLUDED.is_new,
      last_year_actual  = EXCLUDED.last_year_actual,
      ly_august         = EXCLUDED.ly_august,
      ly_september      = EXCLUDED.ly_september,
      ly_october        = EXCLUDED.ly_october,
      ly_november       = EXCLUDED.ly_november,
      ly_december       = EXCLUDED.ly_december,
      ly_january        = EXCLUDED.ly_january,
      ly_february       = EXCLUDED.ly_february,
      ly_march          = EXCLUDED.ly_march,
      ly_april          = EXCLUDED.ly_april,
      ly_may            = EXCLUDED.ly_may,
      ly_june           = EXCLUDED.ly_june,
      ly_july           = EXCLUDED.ly_july,
      ytd_usage         = EXCLUDED.ytd_usage,
      synced_at         = EXCLUDED.synced_at,
      updated_at        = EXCLUDED.updated_at
    RETURNING xmax::text
  LOOP
    IF v_xmax = '0' THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;
    v_won_count := v_won_count + 1;
  END LOOP;

  -- Return aggregate counts (lost_count always 0 -- no more lost bid insertion)
  records_inserted := v_inserted;
  records_updated  := v_updated;
  records_total    := v_inserted + v_updated;
  won_count        := v_won_count;
  lost_count       := 0;
  RETURN NEXT;
END;
$func$;
