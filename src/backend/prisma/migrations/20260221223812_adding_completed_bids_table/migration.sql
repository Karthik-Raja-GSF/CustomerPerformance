-- CreateTable
CREATE TABLE "dw2_nav"."completed_bid" (
    "source_db" TEXT NOT NULL,
    "hash" TEXT,
    "sales_type" INTEGER,
    "sales_code" TEXT NOT NULL,
    "customer_bid_no_" TEXT NOT NULL,
    "data_inserted" TEXT,
    "user_name" TEXT,

    CONSTRAINT "completed_bid_pkey" PRIMARY KEY ("source_db","sales_code","customer_bid_no_")
);
