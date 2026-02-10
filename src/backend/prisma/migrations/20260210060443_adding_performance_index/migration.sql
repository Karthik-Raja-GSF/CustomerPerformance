-- CreateIndex
CREATE INDEX "customer_bid_data_school_year_site_code_item_no_customer_bi_idx" ON "ait"."customer_bid_data"("school_year", "site_code", "item_no", "customer_bill_to");
