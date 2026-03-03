/**
 * Dynamic SQL WHERE clause builder for E&O risk review queries.
 * Follows the same pattern as bid-filters.ts.
 *
 * Table alias conventions:
 *   ri = risk_items CTE, i = item, sku = stockkeeping_unit
 */
import { Prisma } from "@prisma/client";

export interface EoFilterParams {
  location?: string;
  itemNo?: string;
  sourceDb?: string;
}

/**
 * Build Prisma.Sql WHERE conditions from E&O filter params.
 * Conditions are ANDed together by the caller.
 */
export function buildEoFilterConditions(filters: EoFilterParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.location) {
    conditions.push(Prisma.sql`ri.location = ${filters.location}`);
  }
  if (filters.itemNo) {
    conditions.push(
      Prisma.sql`ri.item_no_ ILIKE ${"%" + filters.itemNo + "%"}`
    );
  }
  if (filters.sourceDb) {
    conditions.push(Prisma.sql`ri.source_db = ${filters.sourceDb}`);
  }

  return conditions;
}
