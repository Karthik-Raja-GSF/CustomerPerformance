-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_class" TEXT,
    "zone" TEXT,
    "erp_status" TEXT,
    "abc_class" TEXT,
    "shelf_life_days" INTEGER,
    "lead_time_days" INTEGER,
    "conditional_status" TEXT,
    "challenge_status" TEXT,
    "site_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_snapshots" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "on_hand_qty" INTEGER NOT NULL,
    "safety_stock" INTEGER,
    "on_order" INTEGER,
    "open_sales" INTEGER,
    "open_estimates" INTEGER,
    "target_stock" INTEGER,
    "preferred_max" INTEGER,
    "max_stock" INTEGER,
    "weeks_supply" DECIMAL(6,2),
    "next_po_date" TIMESTAMP(3),
    "next_po_qty" INTEGER,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_actuals" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_actuals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecasts" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "forecast_month" TIMESTAMP(3) NOT NULL,
    "predicted_qty" INTEGER NOT NULL,
    "variance_pct" DECIMAL(6,2),
    "supply_variance" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_metrics" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "total_customers" INTEGER,
    "top_customers" TEXT,
    "buyer" TEXT,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "import_date" TIMESTAMP(3) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "rows_processed" INTEGER,
    "rows_created" INTEGER,
    "rows_updated" INTEGER,
    "rows_failed" INTEGER,
    "error_log" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "items_code_idx" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_category_class_idx" ON "items"("category_class");

-- CreateIndex
CREATE INDEX "items_abc_class_idx" ON "items"("abc_class");

-- CreateIndex
CREATE UNIQUE INDEX "items_site_id_code_key" ON "items"("site_id", "code");

-- CreateIndex
CREATE INDEX "inventory_snapshots_item_id_snapshot_date_idx" ON "inventory_snapshots"("item_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "inventory_snapshots_site_id_snapshot_date_idx" ON "inventory_snapshots"("site_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "sales_actuals_item_id_period_date_idx" ON "sales_actuals"("item_id", "period_date");

-- CreateIndex
CREATE INDEX "sales_actuals_site_id_period_date_idx" ON "sales_actuals"("site_id", "period_date");

-- CreateIndex
CREATE UNIQUE INDEX "sales_actuals_item_id_site_id_period_type_period_label_key" ON "sales_actuals"("item_id", "site_id", "period_type", "period_label");

-- CreateIndex
CREATE INDEX "forecasts_item_id_forecast_month_idx" ON "forecasts"("item_id", "forecast_month");

-- CreateIndex
CREATE UNIQUE INDEX "forecasts_item_id_site_id_forecast_month_key" ON "forecasts"("item_id", "site_id", "forecast_month");

-- CreateIndex
CREATE INDEX "customer_metrics_item_id_snapshot_date_idx" ON "customer_metrics"("item_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "import_logs_import_date_idx" ON "import_logs"("import_date");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_actuals" ADD CONSTRAINT "sales_actuals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_actuals" ADD CONSTRAINT "sales_actuals_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_metrics" ADD CONSTRAINT "customer_metrics_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
