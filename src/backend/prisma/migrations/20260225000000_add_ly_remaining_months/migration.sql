-- Add remaining Last Year monthly columns (Nov-Jul) to customer_bid_data
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_november" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_december" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_january" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_february" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_march" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_april" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_may" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_june" DECIMAL(65,30);
ALTER TABLE ait.customer_bid_data ADD COLUMN "ly_july" DECIMAL(65,30);
