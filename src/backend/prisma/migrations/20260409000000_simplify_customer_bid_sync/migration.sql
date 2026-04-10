-- ============================================================
-- Block A: Merge (sales_type=0, sales_type=3) duplicate pairs in place.
--
-- Migration 20260403 added sales_type to the unique key, allowing two
-- rows per (source_db, site_code, customer_bill_to, item_no, school_year).
-- Under the 5-field unique key restored by Block B, duplicates must be
-- collapsed first. "Direct wins": keep the sales_type=0 row, move the
-- coop row's com_co_op_code onto it, delete the coop row.
-- ============================================================

-- A.1: Copy com_co_op_code from the coop row onto the direct row
-- (only when direct's value is currently NULL — don't clobber a deliberate value).
UPDATE ait.customer_bid_data direct_row
SET com_co_op_code = coop_row.com_co_op_code,
    updated_at     = NOW()
FROM ait.customer_bid_data coop_row
WHERE direct_row.source_db        = coop_row.source_db
  AND direct_row.site_code        = coop_row.site_code
  AND direct_row.customer_bill_to = coop_row.customer_bill_to
  AND direct_row.item_no          = coop_row.item_no
  AND direct_row.school_year      = coop_row.school_year
  AND direct_row.sales_type       = 0
  AND coop_row.sales_type         = 3
  AND direct_row.com_co_op_code IS NULL;

-- A.2: Re-point any customer_bid_export_item.bid_id FKs from coop row to
-- direct row. FK is ON DELETE RESTRICT, so this MUST happen before A.3.
UPDATE ait.customer_bid_export_item ei
SET bid_id = direct_row.id
FROM ait.customer_bid_data direct_row
INNER JOIN ait.customer_bid_data coop_row
  ON  direct_row.source_db        = coop_row.source_db
  AND direct_row.site_code        = coop_row.site_code
  AND direct_row.customer_bill_to = coop_row.customer_bill_to
  AND direct_row.item_no          = coop_row.item_no
  AND direct_row.school_year      = coop_row.school_year
  AND direct_row.sales_type       = 0
  AND coop_row.sales_type         = 3
WHERE ei.bid_id = coop_row.id;

-- A.3: Delete coop rows whose direct sibling exists.
DELETE FROM ait.customer_bid_data coop_row
USING ait.customer_bid_data direct_row
WHERE direct_row.source_db        = coop_row.source_db
  AND direct_row.site_code        = coop_row.site_code
  AND direct_row.customer_bill_to = coop_row.customer_bill_to
  AND direct_row.item_no          = coop_row.item_no
  AND direct_row.school_year      = coop_row.school_year
  AND direct_row.sales_type       = 0
  AND coop_row.sales_type         = 3;

-- ============================================================
-- Block B: Swap the unique index from 6 fields back to 5 fields.
-- Must run AFTER Block A or CREATE UNIQUE INDEX would fail on duplicates.
-- ============================================================
DROP INDEX IF EXISTS "ait"."customer_bid_data_source_db_site_code_customer_bill_to_item_key";
CREATE UNIQUE INDEX "customer_bid_data_source_db_site_code_customer_bill_to_item_key"
  ON "ait"."customer_bid_data"("source_db", "site_code", "customer_bill_to", "item_no", "school_year");

-- ============================================================
-- Block C: Replace ait.sync_customer_bids() with the coop-enriched version.
--
-- Structural changes vs. the previous (20260403) function body:
--   1. New cy_coop_campaign_by_customer CTE — lookup of "which coop is this
--      customer in for this item" in the current year.
--   2. current_year_bids is now a UNION ALL of a direct branch (sales_type=0,
--      enriched via LEFT JOIN to the lookup) + a coop-only branch
--      (sales_type=3, excluded if a direct price exists via NOT EXISTS).
--   3. last_year_bids mirrors the same UNION ALL shape (without com_co_op_code).
--   4. INSERT and SET clauses include sales_type + com_co_op_code.
--   5. Uses the 5-field ON CONFLICT target.
--   6. open_orders CTE remains in place (baseline already had it).
-- ============================================================
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
  v_inserted   INTEGER := 0;
  v_updated    INTEGER := 0;
  v_won_count  INTEGER := 0;
  v_xmax       TEXT;
BEGIN

  -- ============================================================
  -- Upsert current year bids with is_new detection.
  --
  -- is_new = TRUE  -> item is in current year but NOT in previous year
  -- is_new = FALSE -> item is in both current and previous year (renewed)
  -- ============================================================
  FOR v_xmax IN
    WITH cy_coop_campaign_by_customer AS (
      -- For each (source_db, customer_bill_to, item_no) where the customer is a
      -- member of a coop that has a sales_type=3 price this year, record which
      -- coop campaign. One row per customer+item; if the customer is in multiple
      -- coops for the same item, pick the lowest sales_code alphabetically for
      -- deterministic re-runs.
      SELECT DISTINCT ON (sp.source_db, ccm.customer_bill_to, sp.item_no_)
        sp.source_db,
        ccm.customer_bill_to,
        sp.item_no_   AS item_no,
        sp.sales_code AS com_co_op_code
      FROM dw2_nav.sales_price sp
      INNER JOIN ait.coop_customer_map ccm
        ON sp.sales_code = ccm.coop_code
       AND sp.source_db  = ccm.source_db
      WHERE sp.sales_type = 3
        AND sp.starting_date >= p_start_date
        AND sp.starting_date <= p_end_date
      ORDER BY sp.source_db, ccm.customer_bill_to, sp.item_no_, sp.sales_code
    ),
    current_year_bids AS (
      -- Branch A: Direct customer bids (sales_type=0). Enriched with
      -- com_co_op_code via LEFT JOIN to cy_coop_campaign_by_customer — if
      -- the customer ALSO happens to be in a coop for the same item, carry
      -- that coop code onto this row. bid_qty / bid_start / bid_end come
      -- from the direct price ("direct wins").
      SELECT
        sp.source_db,
        c.location_code  AS site_code,
        sp.sales_code    AS customer_bill_to,
        sp.item_no_      AS item_no,
        SUM(sp.customer_bid_qty_) AS bid_qty,
        MIN(sp.starting_date)     AS bid_start,
        MAX(sp.ending_date)       AS bid_end,
        0                         AS sales_type,
        MAX(cc.com_co_op_code)    AS com_co_op_code
      FROM dw2_nav.sales_price sp
      INNER JOIN dw2_nav.customer c
        ON sp.sales_code = c.no_
       AND sp.source_db = c.source_db
      LEFT JOIN cy_coop_campaign_by_customer cc
        ON cc.source_db        = sp.source_db
       AND cc.customer_bill_to = sp.sales_code
       AND cc.item_no          = sp.item_no_
      WHERE sp.sales_type = 0
        AND sp.starting_date >= p_start_date
        AND sp.starting_date <= p_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_

      UNION ALL

      -- Branch B: Coop-only customers. The customer is a member of a coop that
      -- has a sales_type=3 price for this item, BUT the customer does NOT have
      -- their own direct price for the same item in the same period.
      SELECT
        sp.source_db,
        c.location_code    AS site_code,
        ccm.customer_bill_to,
        sp.item_no_        AS item_no,
        SUM(sp.customer_bid_qty_) AS bid_qty,
        MIN(sp.starting_date)     AS bid_start,
        MAX(sp.ending_date)       AS bid_end,
        3                         AS sales_type,
        sp.sales_code             AS com_co_op_code
      FROM dw2_nav.sales_price sp
      INNER JOIN ait.coop_customer_map ccm
        ON sp.sales_code = ccm.coop_code
       AND sp.source_db  = ccm.source_db
      INNER JOIN dw2_nav.customer c
        ON ccm.customer_bill_to = c.no_
       AND ccm.source_db        = c.source_db
      WHERE sp.sales_type = 3
        AND sp.starting_date >= p_start_date
        AND sp.starting_date <= p_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
        AND NOT EXISTS (
          SELECT 1 FROM dw2_nav.sales_price sp0
          WHERE sp0.source_db    = sp.source_db
            AND sp0.sales_type   = 0
            AND sp0.sales_code   = ccm.customer_bill_to
            AND sp0.item_no_     = sp.item_no_
            AND sp0.starting_date >= p_start_date
            AND sp0.starting_date <= p_end_date
        )
      GROUP BY sp.source_db, c.location_code, ccm.customer_bill_to, sp.item_no_, sp.sales_code
    ),
    last_year_bids AS (
      -- Branch A: Direct last-year bids (sales_type=0)
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
      WHERE sp.sales_type = 0
        AND sp.starting_date >= p_ly_start_date
        AND sp.starting_date <= p_ly_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_

      UNION ALL

      -- Branch B: Coop-only last-year bids (customer has no direct equivalent)
      SELECT
        sp.source_db,
        c.location_code    AS site_code,
        ccm.customer_bill_to,
        sp.item_no_        AS item_no,
        SUM(sp.customer_bid_qty_) AS bid_qty
      FROM dw2_nav.sales_price sp
      INNER JOIN ait.coop_customer_map ccm
        ON sp.sales_code = ccm.coop_code
       AND sp.source_db  = ccm.source_db
      INNER JOIN dw2_nav.customer c
        ON ccm.customer_bill_to = c.no_
       AND ccm.source_db        = c.source_db
      WHERE sp.sales_type = 3
        AND sp.starting_date >= p_ly_start_date
        AND sp.starting_date <= p_ly_end_date
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
        AND NOT EXISTS (
          SELECT 1 FROM dw2_nav.sales_price sp0
          WHERE sp0.source_db    = sp.source_db
            AND sp0.sales_type   = 0
            AND sp0.sales_code   = ccm.customer_bill_to
            AND sp0.item_no_     = sp.item_no_
            AND sp0.starting_date >= p_ly_start_date
            AND sp0.starting_date <= p_ly_end_date
        )
      GROUP BY sp.source_db, c.location_code, ccm.customer_bill_to, sp.item_no_
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
        AND sih.posting_date >= p_start_date
        AND sih.posting_date <= LEAST(p_end_date, CURRENT_DATE)
        AND c.location_code IS NOT NULL
        AND c.location_code != ''
      GROUP BY ile.source_db, c.location_code, sih.bill_to_customer_no_, ile.item_no_
    ),
    open_orders AS (
      SELECT
        sl.source_db,
        sl.location_code AS site_code,
        sl.bill_to_customer_no_ AS customer_bill_to,
        sl.no_ AS item_no,
        SUM(sl.quantity) AS open_order_qty
      FROM dw2_nav.sales_line sl
      WHERE sl.document_type = 1
        AND sl.shipment_date >= CURRENT_DATE
      GROUP BY sl.source_db, sl.location_code, sl.bill_to_customer_no_, sl.no_
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
      id,
      source_db, site_code, customer_bill_to, item_no, school_year,
      sales_type, com_co_op_code,
      bid_qty, bid_start, bid_end, erp_status,
      last_year_bid_qty, is_new, last_year_actual,
      ly_august, ly_september, ly_october, ly_november, ly_december,
      ly_january, ly_february, ly_march, ly_april, ly_may, ly_june, ly_july,
      cy_august, cy_september, cy_october, cy_november, cy_december,
      cy_january, cy_february, cy_march, cy_april, cy_may, cy_june, cy_july,
      open_order_qty,
      synced_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      cb.source_db,
      cb.site_code,
      cb.customer_bill_to,
      cb.item_no,
      p_school_year,
      cb.sales_type,
      cb.com_co_op_code,
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
      cys.aug_qty, cys.sep_qty, cys.oct_qty, cys.nov_qty, cys.dec_qty,
      cys.jan_qty, cys.feb_qty, cys.mar_qty, cys.apr_qty, cys.may_qty,
      cys.jun_qty, cys.jul_qty,
      oo.open_order_qty,
      NOW(),
      NOW()
    FROM current_year_bids cb
    LEFT JOIN last_year_bids lyb
      ON  cb.source_db        = lyb.source_db
      AND cb.site_code        = lyb.site_code
      AND cb.customer_bill_to = lyb.customer_bill_to
      AND cb.item_no          = lyb.item_no
    LEFT JOIN last_year_sales lys
      ON  cb.source_db        = lys.source_db
      AND cb.site_code        = lys.site_code
      AND cb.customer_bill_to = lys.customer_bill_to
      AND cb.item_no          = lys.item_no
    LEFT JOIN current_year_sales cys
      ON  cb.source_db        = cys.source_db
      AND cb.site_code        = cys.site_code
      AND cb.customer_bill_to = cys.customer_bill_to
      AND cb.item_no          = cys.item_no
    LEFT JOIN open_orders oo
      ON  cb.source_db        = oo.source_db
      AND cb.site_code        = oo.site_code
      AND cb.customer_bill_to = oo.customer_bill_to
      AND cb.item_no          = oo.item_no
    LEFT JOIN erp_status erp
      ON  cb.source_db = erp.source_db
      AND cb.item_no   = erp.item_no
    ON CONFLICT (source_db, site_code, customer_bill_to, item_no, school_year)
    DO UPDATE SET
      sales_type        = EXCLUDED.sales_type,
      com_co_op_code    = EXCLUDED.com_co_op_code,
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
      cy_august         = EXCLUDED.cy_august,
      cy_september      = EXCLUDED.cy_september,
      cy_october        = EXCLUDED.cy_october,
      cy_november       = EXCLUDED.cy_november,
      cy_december       = EXCLUDED.cy_december,
      cy_january        = EXCLUDED.cy_january,
      cy_february       = EXCLUDED.cy_february,
      cy_march          = EXCLUDED.cy_march,
      cy_april          = EXCLUDED.cy_april,
      cy_may            = EXCLUDED.cy_may,
      cy_june           = EXCLUDED.cy_june,
      cy_july           = EXCLUDED.cy_july,
      open_order_qty    = EXCLUDED.open_order_qty,
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

  -- Return aggregate counts (lost_count always 0 — no more lost bid insertion)
  records_inserted := v_inserted;
  records_updated  := v_updated;
  records_total    := v_inserted + v_updated;
  won_count        := v_won_count;
  lost_count       := 0;
  RETURN NEXT;
END;
$func$;
