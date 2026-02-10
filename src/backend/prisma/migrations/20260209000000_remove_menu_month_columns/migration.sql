-- DropColumns: Remove menu month boolean columns from customer_bid_data
-- Menu months are now managed as frontend-only UI state, derived from estimates.
ALTER TABLE "ait"."customer_bid_data"
  DROP COLUMN "jan",
  DROP COLUMN "feb",
  DROP COLUMN "mar",
  DROP COLUMN "apr",
  DROP COLUMN "may",
  DROP COLUMN "jun",
  DROP COLUMN "jul",
  DROP COLUMN "aug",
  DROP COLUMN "sep",
  DROP COLUMN "oct",
  DROP COLUMN "nov",
  DROP COLUMN "dec";
