-- AlterTable
ALTER TABLE "forecasts" ALTER COLUMN "variance_pct" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "inventory_snapshots" ALTER COLUMN "weeks_supply" SET DATA TYPE DECIMAL(10,2);
