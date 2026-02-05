-- AlterTable
ALTER TABLE "ait"."customer_bid_data" ADD COLUMN     "last_updated_at" TIMESTAMP(3),
ADD COLUMN     "last_updated_by" TEXT;
