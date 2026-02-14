/**
 * Shared filter-to-SQL builder for customer bid queries.
 * Used by CustomerBidService.getCustomerBids() and BidExportService.resolveFiltersToBidKeys().
 */
import { Prisma } from "@prisma/client";

export interface BidFilterParams {
  siteCode?: string;
  customerBillTo?: string;
  customerName?: string;
  salesRep?: string;
  itemCode?: string;
  erpStatus?: string;
  sourceDb?: string;
  coOpCode?: string;
  isLost?: boolean;
  confirmed?: boolean;
  exported?: boolean;
}

/**
 * Build Prisma.Sql WHERE conditions from filter params.
 * Assumes table aliases: `cbd` for customer_bid_data, `c` for customer.
 */
export function buildBidFilterConditions(
  filters: BidFilterParams
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.siteCode) {
    conditions.push(Prisma.sql`cbd.site_code = ${filters.siteCode}`);
  }
  if (filters.customerBillTo) {
    conditions.push(
      Prisma.sql`cbd.customer_bill_to ILIKE ${
        "%" + filters.customerBillTo + "%"
      }`
    );
  }
  if (filters.customerName) {
    conditions.push(
      Prisma.sql`c."name" ILIKE ${"%" + filters.customerName + "%"}`
    );
  }
  if (filters.salesRep) {
    conditions.push(Prisma.sql`c.salesperson_code = ${filters.salesRep}`);
  }
  if (filters.itemCode) {
    conditions.push(Prisma.sql`cbd.item_no = ${filters.itemCode}`);
  }
  if (filters.erpStatus) {
    conditions.push(
      Prisma.sql`cbd.erp_status ILIKE ${"%" + filters.erpStatus + "%"}`
    );
  }
  if (filters.sourceDb) {
    conditions.push(Prisma.sql`cbd.source_db = ${filters.sourceDb}`);
  }
  if (filters.coOpCode) {
    conditions.push(Prisma.sql`c.co_op_code = ${filters.coOpCode}`);
  }

  if (filters.isLost !== undefined) {
    conditions.push(Prisma.sql`cbd.is_lost = ${filters.isLost}`);
  }
  // Filter out rows with NULL bid dates unless explicitly viewing lost bids
  if (filters.isLost !== true) {
    conditions.push(
      Prisma.sql`cbd.bid_start IS NOT NULL AND cbd.bid_end IS NOT NULL`
    );
  }

  if (filters.confirmed !== undefined) {
    conditions.push(
      filters.confirmed
        ? Prisma.sql`cbd.confirmed_at IS NOT NULL`
        : Prisma.sql`cbd.confirmed_at IS NULL`
    );
  }
  if (filters.exported !== undefined) {
    conditions.push(
      filters.exported
        ? Prisma.sql`cbd.last_exported_at IS NOT NULL`
        : Prisma.sql`cbd.last_exported_at IS NULL`
    );
  }

  return conditions;
}
