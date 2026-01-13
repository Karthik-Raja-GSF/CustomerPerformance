/*
  Warnings:

  - The primary key for the `pallet_bin_content` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `sales_price` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "dw2_nav"."pallet_bin_content" DROP CONSTRAINT "pallet_bin_content_pkey",
ALTER COLUMN "unit_of_measure" DROP NOT NULL,
ADD CONSTRAINT "pallet_bin_content_pkey" PRIMARY KEY ("source_db", "bin", "location", "pallet_no_", "box_no_", "item_no_", "variant_no_", "lot_no_", "serial_no_");

-- AlterTable
ALTER TABLE "dw2_nav"."sales_price" DROP CONSTRAINT "sales_price_pkey",
ALTER COLUMN "unit_of_measure_code" DROP NOT NULL,
ADD CONSTRAINT "sales_price_pkey" PRIMARY KEY ("source_db", "item_no_", "sales_type", "sales_code", "starting_date", "currency_code", "variant_code", "minimum_quantity");
