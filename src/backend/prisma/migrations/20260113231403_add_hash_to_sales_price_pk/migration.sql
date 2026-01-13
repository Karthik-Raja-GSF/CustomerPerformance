/*
  Warnings:

  - The primary key for the `sales_price` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `hash` on table `sales_price` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "dw2_nav"."sales_price" DROP CONSTRAINT "sales_price_pkey",
ALTER COLUMN "hash" SET NOT NULL,
ADD CONSTRAINT "sales_price_pkey" PRIMARY KEY ("source_db", "item_no_", "hash");
