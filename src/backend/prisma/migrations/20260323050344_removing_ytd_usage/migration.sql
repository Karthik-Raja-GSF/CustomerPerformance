/*
  Warnings:

  - You are about to drop the column `ytd_usage` on the `customer_bid_data` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ait"."customer_bid_data" DROP COLUMN "ytd_usage";
