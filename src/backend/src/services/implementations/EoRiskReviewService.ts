import { injectable, inject } from "tsyringe";
import { Prisma, PrismaClient } from "@prisma/client";
import type { IEoRiskReviewService } from "@/services/IEoRiskReviewService";
import type {
  EoRiskReviewQueryDto,
  EoRiskReviewListResponseDto,
  EoRiskItemDto,
  EoFilterOptionsDto,
} from "@/contracts/dtos/eo-risk-review.dto";
import { buildEoFilterConditions } from "@/services/helpers/eo-filters";

/** Criteria badge labels matching the Figma design */
const CRITERIA_LABELS = {
  aged: "30+ days on Hand (Aged Inventory)",
  excess: "Excess",
  dead: "Dead",
  expiring: "QTY not to sell by expiration based on 6 week average sale",
} as const;

/** Raw row shape returned by the main risk query */
interface RiskItemRow {
  source_db: string;
  location: string;
  item_no_: string;
  description: string | null;
  vendor_name: string | null;
  vendor_no: string | null;
  buyer_name: string | null;
  quantity: Prisma.Decimal | null;
  total_value: Prisma.Decimal | null;
  days_in_inventory: number | null;
  expiration_date: Date | null;
  avg_weekly_sale: Prisma.Decimal | null;
  is_aged: boolean;
  is_excess: boolean;
  is_dead: boolean;
  is_expiring: boolean;
}

/** Raw row shape for the count query */
interface CountRow {
  total: bigint;
}

@injectable()
export class EoRiskReviewService implements IEoRiskReviewService {
  private prisma: PrismaClient;

  constructor(@inject("PrismaClient") prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getRiskItems(
    query: EoRiskReviewQueryDto
  ): Promise<EoRiskReviewListResponseDto> {
    const { page, limit, agingDays, lookbackDays, excessDays } = query;
    const offset = (page - 1) * limit;

    // Build dynamic filter conditions
    const filterConditions = buildEoFilterConditions({
      location: query.location,
      itemNo: query.itemNo,
      sourceDb: query.sourceDb,
    });
    const dynamicWhere =
      filterConditions.length > 0
        ? Prisma.sql`AND ${Prisma.join(filterConditions, " AND ")}`
        : Prisma.empty;

    // Shared CTEs for risk computation
    const ctes = this.buildRiskCTEs(agingDays, lookbackDays, excessDays);

    // Main data query (limit+1 for hasMore detection)
    const dataQuery = Prisma.sql`
      ${ctes}

      SELECT
        ri.source_db,
        ri.location,
        ri.item_no_,
        i.description,
        v.name AS vendor_name,
        i.vendor_no_ AS vendor_no,
        i.buyer_code AS buyer_name,
        ri.total_qty AS quantity,
        ri.total_qty * COALESCE(sku.unit_cost, i.unit_cost, 0) AS total_value,
        ri.max_days_on_hand AS days_in_inventory,
        ri.earliest_expiry AS expiration_date,
        ri.avg_daily_usage * 7 AS avg_weekly_sale,
        ri.is_aged,
        ri.is_excess,
        ri.is_dead,
        ri.is_expiring
      FROM risk_items ri
      LEFT JOIN dw2_nav.item i
        ON ri.source_db = i.source_db AND ri.item_no_ = i.no_
      LEFT JOIN dw2_nav.vendor v
        ON i.source_db = v.source_db AND i.vendor_no_ = v.no_
      LEFT JOIN dw2_nav.stockkeeping_unit sku
        ON ri.source_db = sku.source_db
        AND ri.location = sku.location_code
        AND ri.item_no_ = sku.item_no_
        AND '' = sku.variant_code
      WHERE (ri.is_aged OR ri.is_excess OR ri.is_dead OR ri.is_expiring)
        ${dynamicWhere}
      ORDER BY ri.total_qty * COALESCE(sku.unit_cost, i.unit_cost, 0) DESC NULLS LAST
      LIMIT ${limit + 1} OFFSET ${offset}
    `;

    // Count query (same CTEs and filters, no LIMIT/OFFSET)
    const countQuery = Prisma.sql`
      ${ctes}

      SELECT COUNT(*) AS total
      FROM risk_items ri
      WHERE (ri.is_aged OR ri.is_excess OR ri.is_dead OR ri.is_expiring)
        ${dynamicWhere}
    `;

    // Execute both queries in parallel
    const [rows, countResult] = await Promise.all([
      this.prisma.$queryRaw<RiskItemRow[]>(dataQuery),
      this.prisma.$queryRaw<CountRow[]>(countQuery),
    ]);

    const totalItemsAtRisk = Number(countResult[0]?.total ?? 0);
    const hasMore = rows.length > limit;
    const trimmedRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: trimmedRows.map((row) => this.toDto(row)),
      page,
      limit,
      hasMore,
      totalItemsAtRisk,
      thresholds: { agingDays, lookbackDays, excessDays },
    };
  }

  async getFilterOptions(): Promise<EoFilterOptionsDto> {
    const [locations, sourceDbs] = await Promise.all([
      this.prisma.$queryRaw<Array<{ location: string }>>`
        SELECT DISTINCT location
        FROM dw2_nav.pallet_bin_content
        WHERE quantity > 0 AND location IS NOT NULL AND location != ''
        ORDER BY location
      `,
      this.prisma.$queryRaw<Array<{ source_db: string }>>`
        SELECT DISTINCT source_db
        FROM dw2_nav.pallet_bin_content
        WHERE quantity > 0
        ORDER BY source_db
      `,
    ]);

    return {
      locations: locations.map((r) => r.location),
      sourceDbs: sourceDbs.map((r) => r.source_db),
    };
  }

  /**
   * Build the shared CTEs that compute on-hand inventory, average usage,
   * items with recent sales, and the 4 boolean risk criteria flags.
   */
  private buildRiskCTEs(
    agingDays: number,
    lookbackDays: number,
    excessDays: number
  ): Prisma.Sql {
    return Prisma.sql`
      WITH
      on_hand AS (
        SELECT
          source_db,
          location,
          item_no_,
          SUM(quantity) AS total_qty,
          MAX(CURRENT_DATE - creation_date::date) AS max_days_on_hand,
          MIN(expiry_date) AS earliest_expiry
        FROM dw2_nav.pallet_bin_content
        WHERE quantity > 0
        GROUP BY source_db, location, item_no_
      ),

      avg_usage AS (
        SELECT
          source_db,
          location_code,
          item_no_,
          SUM(ABS(quantity)) / ${lookbackDays}::numeric AS avg_daily_usage
        FROM dw2_nav.item_ledger_entry
        WHERE document_type = 1
          AND quantity < 0
          AND posting_date >= CURRENT_DATE - (${lookbackDays}::int || ' days')::interval
        GROUP BY source_db, location_code, item_no_
      ),

      items_with_sales AS (
        SELECT DISTINCT source_db, location_code, item_no_
        FROM dw2_nav.item_ledger_entry
        WHERE document_type = 1
          AND quantity < 0
          AND posting_date >= CURRENT_DATE - (${lookbackDays}::int || ' days')::interval
      ),

      risk_items AS (
        SELECT
          oh.source_db,
          oh.location,
          oh.item_no_,
          oh.total_qty,
          oh.max_days_on_hand,
          oh.earliest_expiry,
          COALESCE(au.avg_daily_usage, 0) AS avg_daily_usage,
          (oh.max_days_on_hand >= ${agingDays}) AS is_aged,
          (oh.total_qty > COALESCE(au.avg_daily_usage, 0) * ${excessDays}) AS is_excess,
          (iws.item_no_ IS NULL) AS is_dead,
          (
            oh.earliest_expiry IS NOT NULL
            AND oh.earliest_expiry > CURRENT_DATE
            AND oh.total_qty > COALESCE(au.avg_daily_usage, 0)
              * (oh.earliest_expiry::date - CURRENT_DATE)
          ) AS is_expiring
        FROM on_hand oh
        LEFT JOIN avg_usage au
          ON oh.source_db = au.source_db
          AND oh.location = au.location_code
          AND oh.item_no_ = au.item_no_
        LEFT JOIN items_with_sales iws
          ON oh.source_db = iws.source_db
          AND oh.location = iws.location_code
          AND oh.item_no_ = iws.item_no_
      )
    `;
  }

  /** Convert a raw SQL row to the API DTO */
  private toDto(row: RiskItemRow): EoRiskItemDto {
    const criteriaMet: string[] = [];
    if (row.is_aged) criteriaMet.push(CRITERIA_LABELS.aged);
    if (row.is_excess) criteriaMet.push(CRITERIA_LABELS.excess);
    if (row.is_dead) criteriaMet.push(CRITERIA_LABELS.dead);
    if (row.is_expiring) criteriaMet.push(CRITERIA_LABELS.expiring);

    return {
      sourceDb: row.source_db,
      location: row.location,
      itemNo: row.item_no_,
      description: row.description,
      vendorName: row.vendor_name,
      vendorNo: row.vendor_no,
      buyerName: row.buyer_name,
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      totalValue: row.total_value != null ? Number(row.total_value) : null,
      daysInInventory: row.days_in_inventory ?? 0,
      expirationDate: row.expiration_date
        ? row.expiration_date.toISOString()
        : null,
      avgWeeklySale:
        row.avg_weekly_sale != null ? Number(row.avg_weekly_sale) : 0,
      criteriaMet,
    };
  }
}
