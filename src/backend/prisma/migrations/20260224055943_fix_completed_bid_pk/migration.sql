/*
  Warnings:

  - The primary key for the `completed_bid` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "dw2_nav"."completed_bid" DROP CONSTRAINT "completed_bid_pkey",
ALTER COLUMN "source_db" DROP NOT NULL,
ADD CONSTRAINT "completed_bid_pkey" PRIMARY KEY ("sales_code", "customer_bid_no_");
