/*
  Warnings:

  - You are about to drop the column `august_demand` on the `customer_bid_data` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed` on the `customer_bid_data` table. All the data in the column will be lost.
  - You are about to drop the column `october_demand` on the `customer_bid_data` table. All the data in the column will be lost.
  - You are about to drop the column `september_demand` on the `customer_bid_data` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ait"."customer_bid_data_confirmed_idx";

-- AlterTable
ALTER TABLE "ait"."customer_bid_data" DROP COLUMN "august_demand",
DROP COLUMN "confirmed",
DROP COLUMN "october_demand",
DROP COLUMN "september_demand",
ADD COLUMN     "estimate_apr" DECIMAL(65,30),
ADD COLUMN     "estimate_aug" DECIMAL(65,30),
ADD COLUMN     "estimate_dec" DECIMAL(65,30),
ADD COLUMN     "estimate_feb" DECIMAL(65,30),
ADD COLUMN     "estimate_jan" DECIMAL(65,30),
ADD COLUMN     "estimate_jul" DECIMAL(65,30),
ADD COLUMN     "estimate_jun" DECIMAL(65,30),
ADD COLUMN     "estimate_mar" DECIMAL(65,30),
ADD COLUMN     "estimate_may" DECIMAL(65,30),
ADD COLUMN     "estimate_nov" DECIMAL(65,30),
ADD COLUMN     "estimate_oct" DECIMAL(65,30),
ADD COLUMN     "estimate_sep" DECIMAL(65,30);

-- CreateIndex
CREATE INDEX "customer_bid_data_confirmed_at_idx" ON "ait"."customer_bid_data"("confirmed_at");
