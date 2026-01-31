-- AlterTable
ALTER TABLE "ait"."customer_bid_data" ADD COLUMN     "bid_end" TIMESTAMP(3),
ADD COLUMN     "bid_start" TIMESTAMP(3),
ADD COLUMN     "erp_status" TEXT;
