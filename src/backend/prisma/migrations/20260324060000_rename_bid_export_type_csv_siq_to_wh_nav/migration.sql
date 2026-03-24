-- Rename BidExportType enum values: CSV → WH, SIQ → NAV
ALTER TYPE "ait"."BidExportType" RENAME VALUE 'CSV' TO 'WH';
ALTER TYPE "ait"."BidExportType" RENAME VALUE 'SIQ' TO 'NAV';
