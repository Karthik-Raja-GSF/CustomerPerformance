-- CreateIndex
CREATE INDEX "idx_sales_price_dates" ON "dw2_nav"."sales_price"("starting_date", "ending_date");

-- CreateIndex
CREATE INDEX "idx_sku_item_source_lastmod" ON "dw2_nav"."stockkeeping_unit"("item_no_", "source_db", "last_date_modified");
