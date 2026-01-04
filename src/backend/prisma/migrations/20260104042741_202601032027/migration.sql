-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "siq";

-- CreateTable
CREATE TABLE "siq"."report_data" (
    "site_code" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "abc_class" TEXT,
    "safety_stock" DECIMAL(65,30),
    "target_stock" DECIMAL(65,30),
    "preferred_max" DECIMAL(65,30),
    "max_stock" DECIMAL(65,30),
    "open_estimates" DECIMAL(65,30),
    "open_sales_plus_estimates" DECIMAL(65,30),
    "current_month_forecast" DECIMAL(65,30),
    "forecast_month_1" DECIMAL(65,30),
    "forecast_month_2" DECIMAL(65,30),
    "forecast_month_3" DECIMAL(65,30),
    "forecast_month_4" DECIMAL(65,30),
    "weeks_supply_onhand" DECIMAL(65,30),
    "weeks_onhand_est" DECIMAL(65,30),
    "forecast_variance_mtd" DECIMAL(65,30),
    "supply_variance" DECIMAL(65,30),
    "total_customers" INTEGER,
    "top_5_customer_ship_tos" TEXT,
    "sync_id" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_data_pkey" PRIMARY KEY ("site_code","item_code")
);

-- CreateTable
CREATE TABLE "siq"."sync_log" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "records_total" INTEGER,
    "records_inserted" INTEGER,
    "records_updated" INTEGER,
    "records_deleted" INTEGER,
    "api_response_status" INTEGER,
    "api_response_time_ms" INTEGER,
    "api_error_message" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "triggered_by" TEXT NOT NULL,

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_data_sync_id_idx" ON "siq"."report_data"("sync_id");

-- CreateIndex
CREATE INDEX "report_data_abc_class_idx" ON "siq"."report_data"("abc_class");

-- CreateIndex
CREATE INDEX "sync_log_status_idx" ON "siq"."sync_log"("status");

-- CreateIndex
CREATE INDEX "sync_log_started_at_idx" ON "siq"."sync_log"("started_at");

-- AddForeignKey
ALTER TABLE "siq"."report_data" ADD CONSTRAINT "report_data_sync_id_fkey" FOREIGN KEY ("sync_id") REFERENCES "siq"."sync_log"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
