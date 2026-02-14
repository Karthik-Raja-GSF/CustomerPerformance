-- CreateEnum
CREATE TYPE "ait"."BidExportType" AS ENUM ('CSV', 'SIQ');

-- AlterTable
ALTER TABLE "ait"."customer_bid_data" ADD COLUMN     "last_exported_at" TIMESTAMP(3),
ADD COLUMN     "last_exported_by" TEXT;

-- CreateTable
CREATE TABLE "ait"."customer_bid_export_run" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "export_type" "ait"."BidExportType" NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "total_records" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "customer_bid_export_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ait"."customer_bid_export_item" (
    "id" TEXT NOT NULL,
    "source_db" TEXT NOT NULL,
    "site_code" TEXT NOT NULL,
    "customer_bill_to" TEXT NOT NULL,
    "item_no" TEXT NOT NULL,
    "school_year" TEXT NOT NULL,
    "export_type" "ait"."BidExportType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "queued_by" TEXT NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_id" TEXT,

    CONSTRAINT "customer_bid_export_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_bid_export_run_status_idx" ON "ait"."customer_bid_export_run"("status");

-- CreateIndex
CREATE INDEX "customer_bid_export_run_started_at_idx" ON "ait"."customer_bid_export_run"("started_at");

-- CreateIndex
CREATE INDEX "customer_bid_export_item_status_idx" ON "ait"."customer_bid_export_item"("status");

-- CreateIndex
CREATE INDEX "customer_bid_export_item_queued_at_idx" ON "ait"."customer_bid_export_item"("queued_at");

-- CreateIndex
CREATE INDEX "customer_bid_export_item_run_id_idx" ON "ait"."customer_bid_export_item"("run_id");

-- CreateIndex
CREATE INDEX "customer_bid_export_item_source_db_site_code_customer_bill__idx" ON "ait"."customer_bid_export_item"("source_db", "site_code", "customer_bill_to", "item_no", "school_year");

-- CreateIndex
CREATE INDEX "customer_bid_data_last_exported_at_idx" ON "ait"."customer_bid_data"("last_exported_at");

-- AddForeignKey
ALTER TABLE "ait"."customer_bid_export_item" ADD CONSTRAINT "customer_bid_export_item_source_db_site_code_customer_bill_fkey" FOREIGN KEY ("source_db", "site_code", "customer_bill_to", "item_no", "school_year") REFERENCES "ait"."customer_bid_data"("source_db", "site_code", "customer_bill_to", "item_no", "school_year") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ait"."customer_bid_export_item" ADD CONSTRAINT "customer_bid_export_item_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ait"."customer_bid_export_run"("id") ON DELETE SET NULL ON UPDATE CASCADE;
