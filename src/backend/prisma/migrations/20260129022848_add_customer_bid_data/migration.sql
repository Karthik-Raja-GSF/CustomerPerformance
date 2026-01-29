-- CreateTable
CREATE TABLE "ait"."customer_bid_data" (
    "source_db" TEXT NOT NULL,
    "site_code" TEXT NOT NULL,
    "customer_bill_to" TEXT NOT NULL,
    "item_no" TEXT NOT NULL,
    "school_year" TEXT NOT NULL,
    "last_year_bid_qty" DECIMAL(65,30),
    "last_year_actual" DECIMAL(65,30),
    "ly_august" DECIMAL(65,30),
    "ly_september" DECIMAL(65,30),
    "ly_october" DECIMAL(65,30),
    "is_lost" BOOLEAN NOT NULL DEFAULT false,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "august_demand" DECIMAL(65,30),
    "september_demand" DECIMAL(65,30),
    "october_demand" DECIMAL(65,30),
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_bid_data_pkey" PRIMARY KEY ("source_db","site_code","customer_bill_to","item_no","school_year")
);

-- CreateTable
CREATE TABLE "ait"."customer_bid_sync_log" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "school_year" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_total" INTEGER,
    "records_inserted" INTEGER,
    "records_updated" INTEGER,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "triggered_by" TEXT NOT NULL,

    CONSTRAINT "customer_bid_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_bid_data_school_year_idx" ON "ait"."customer_bid_data"("school_year");

-- CreateIndex
CREATE INDEX "customer_bid_data_confirmed_idx" ON "ait"."customer_bid_data"("confirmed");

-- CreateIndex
CREATE INDEX "customer_bid_data_is_lost_idx" ON "ait"."customer_bid_data"("is_lost");

-- CreateIndex
CREATE INDEX "customer_bid_sync_log_school_year_idx" ON "ait"."customer_bid_sync_log"("school_year");

-- CreateIndex
CREATE INDEX "customer_bid_sync_log_status_idx" ON "ait"."customer_bid_sync_log"("status");
