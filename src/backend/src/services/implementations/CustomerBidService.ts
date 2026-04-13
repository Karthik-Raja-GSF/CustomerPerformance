import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma, type CustomerBidData } from "@prisma/client";
import { ICustomerBidService } from "@/services/ICustomerBidService";
import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidDto,
  CustomerBidKeyDto,
  UpdateCustomerBidDto,
  BulkUpdateCustomerBidDto,
  BulkUpdateResultDto,
  BulkUpdatePreviewResultDto,
  CustomerBidFilterOptionsDto,
  CustomerBidStatsDto,
  SyncResultDto,
  SyncLogDto,
  SchoolYear,
} from "@/contracts/dtos/customer-bid.dto";
import {
  CustomerBidDatabaseError,
  CustomerBidQueryError,
  CustomerBidSyncInProgressError,
  CustomerBidNotFoundError,
} from "@/utils/errors/customer-bid-errors";
import { createChildLogger } from "@/telemetry/logger";
import { IRbacService, RBAC_SERVICE_TOKEN } from "@/services/IRbacService";
import { Role } from "@/contracts/rbac/role";
import { ESTIMATE_FIELDS } from "@/services/helpers/bid-converters";
import { buildBidFilterConditions } from "@/services/helpers/bid-filters";
import {
  getSchoolYearBoundaries,
  getSchoolYearString,
} from "@/services/helpers/school-year";

const logger = createChildLogger("customer-bid");

/**
 * Raw database row result from the base customer bids query
 */
interface BaseBidRow {
  id: string;
  salesType: number;
  sourceDb: string | null;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  coOpCode: string | null;
  comCoOpCode: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  itemNo: string;
  itemDescription: string | null;
  brandName: string | null;
  packSize: string | null;
  customerLeadTime: number | null;
  bidQty: Prisma.Decimal | null;
  bidStart: Date;
  bidEnd: Date | null;
  erpStatus: string | null;
  // From customer_bid_data table (LEFT JOIN)
  lastYearBidQty: Prisma.Decimal | null;
  lastYearActual: Prisma.Decimal | null;
  lyAugust: Prisma.Decimal | null;
  lySeptember: Prisma.Decimal | null;
  lyOctober: Prisma.Decimal | null;
  lyNovember: Prisma.Decimal | null;
  lyDecember: Prisma.Decimal | null;
  lyJanuary: Prisma.Decimal | null;
  lyFebruary: Prisma.Decimal | null;
  lyMarch: Prisma.Decimal | null;
  lyApril: Prisma.Decimal | null;
  lyMay: Prisma.Decimal | null;
  lyJune: Prisma.Decimal | null;
  lyJuly: Prisma.Decimal | null;
  // Current year monthly actuals
  cyAugust: Prisma.Decimal | null;
  cySeptember: Prisma.Decimal | null;
  cyOctober: Prisma.Decimal | null;
  cyNovember: Prisma.Decimal | null;
  cyDecember: Prisma.Decimal | null;
  cyJanuary: Prisma.Decimal | null;
  cyFebruary: Prisma.Decimal | null;
  cyMarch: Prisma.Decimal | null;
  cyApril: Prisma.Decimal | null;
  cyMay: Prisma.Decimal | null;
  cyJune: Prisma.Decimal | null;
  cyJuly: Prisma.Decimal | null;
  isNew: boolean | null;
  lastUpdatedAt: Date | null;
  lastUpdatedBy: string | null;
  confirmedAt: Date | null;
  confirmedBy: string | null;
  lastExportedAt: Date | null;
  lastExportedBy: string | null;
  yearAround: boolean | null;
  // Monthly estimates
  estimateJan: Prisma.Decimal | null;
  estimateFeb: Prisma.Decimal | null;
  estimateMar: Prisma.Decimal | null;
  estimateApr: Prisma.Decimal | null;
  estimateMay: Prisma.Decimal | null;
  estimateJun: Prisma.Decimal | null;
  estimateJul: Prisma.Decimal | null;
  estimateAug: Prisma.Decimal | null;
  estimateSep: Prisma.Decimal | null;
  estimateOct: Prisma.Decimal | null;
  estimateNov: Prisma.Decimal | null;
  estimateDec: Prisma.Decimal | null;
  openOrderQty: Prisma.Decimal | null;
}

/**
 * Customer Bid Service Implementation
 *
 * Retrieves customer bid data from NAV database tables with
 * school year filtering support.
 *
 * Performance optimization: Uses a single materialized CTE query
 * instead of multiple parallel queries.
 */
@injectable()
export class CustomerBidService implements ICustomerBidService {
  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient,
    @inject(RBAC_SERVICE_TOKEN) private readonly rbacService: IRbacService
  ) {}

  /**
   * Shared mapper from raw SQL row to CustomerBidDto.
   * Used by both getCustomerBids (list path) and fetchBidById (single-record path).
   */
  private mapBaseRowToDto(row: BaseBidRow): CustomerBidDto {
    return {
      id: row.id,
      salesType: row.salesType,
      sourceDb: row.sourceDb,
      siteCode: row.siteCode,
      customerName: row.customerName,
      customerBillTo: row.customerBillTo,
      coOpCode: row.coOpCode,
      comCoOpCode: row.comCoOpCode,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      salesRep: row.salesRep,
      bidStartDate: row.bidStart?.toISOString() ?? "",
      bidEndDate: row.bidEnd?.toISOString() ?? null,
      itemCode: row.itemNo,
      itemDescription: row.itemDescription,
      brandName: row.brandName,
      packSize: row.packSize,
      customerLeadTime: row.customerLeadTime ?? null,
      erpStatus: row.erpStatus,
      bidQuantity: row.bidQty ? Number(row.bidQty) : null,
      lastYearBidQty: row.lastYearBidQty ? Number(row.lastYearBidQty) : null,
      lastYearActual: row.lastYearActual ? Number(row.lastYearActual) : null,
      lyAugust: row.lyAugust ? Number(row.lyAugust) : null,
      lySeptember: row.lySeptember ? Number(row.lySeptember) : null,
      lyOctober: row.lyOctober ? Number(row.lyOctober) : null,
      lyNovember: row.lyNovember ? Number(row.lyNovember) : null,
      lyDecember: row.lyDecember ? Number(row.lyDecember) : null,
      lyJanuary: row.lyJanuary ? Number(row.lyJanuary) : null,
      lyFebruary: row.lyFebruary ? Number(row.lyFebruary) : null,
      lyMarch: row.lyMarch ? Number(row.lyMarch) : null,
      lyApril: row.lyApril ? Number(row.lyApril) : null,
      lyMay: row.lyMay ? Number(row.lyMay) : null,
      lyJune: row.lyJune ? Number(row.lyJune) : null,
      lyJuly: row.lyJuly ? Number(row.lyJuly) : null,
      cyAugust: row.cyAugust ? Number(row.cyAugust) : null,
      cySeptember: row.cySeptember ? Number(row.cySeptember) : null,
      cyOctober: row.cyOctober ? Number(row.cyOctober) : null,
      cyNovember: row.cyNovember ? Number(row.cyNovember) : null,
      cyDecember: row.cyDecember ? Number(row.cyDecember) : null,
      cyJanuary: row.cyJanuary ? Number(row.cyJanuary) : null,
      cyFebruary: row.cyFebruary ? Number(row.cyFebruary) : null,
      cyMarch: row.cyMarch ? Number(row.cyMarch) : null,
      cyApril: row.cyApril ? Number(row.cyApril) : null,
      cyMay: row.cyMay ? Number(row.cyMay) : null,
      cyJune: row.cyJune ? Number(row.cyJune) : null,
      cyJuly: row.cyJuly ? Number(row.cyJuly) : null,
      isNew: row.isNew ?? false,
      lastUpdatedAt: row.lastUpdatedAt?.toISOString() ?? null,
      lastUpdatedBy: row.lastUpdatedBy ?? null,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      confirmedBy: row.confirmedBy ?? null,
      lastExportedAt: row.lastExportedAt?.toISOString() ?? null,
      lastExportedBy: row.lastExportedBy ?? null,
      yearAround: row.yearAround ?? false,
      estimateJan: row.estimateJan ? Number(row.estimateJan) : null,
      estimateFeb: row.estimateFeb ? Number(row.estimateFeb) : null,
      estimateMar: row.estimateMar ? Number(row.estimateMar) : null,
      estimateApr: row.estimateApr ? Number(row.estimateApr) : null,
      estimateMay: row.estimateMay ? Number(row.estimateMay) : null,
      estimateJun: row.estimateJun ? Number(row.estimateJun) : null,
      estimateJul: row.estimateJul ? Number(row.estimateJul) : null,
      estimateAug: row.estimateAug ? Number(row.estimateAug) : null,
      estimateSep: row.estimateSep ? Number(row.estimateSep) : null,
      estimateOct: row.estimateOct ? Number(row.estimateOct) : null,
      estimateNov: row.estimateNov ? Number(row.estimateNov) : null,
      estimateDec: row.estimateDec ? Number(row.estimateDec) : null,
      openOrderQty: row.openOrderQty ? Number(row.openOrderQty) : 0,
    };
  }

  /**
   * Fetch a single bid by UUID, returning a fully populated DTO via the same JOIN
   * shape as getCustomerBids. Used after mutations to return the updated record.
   */
  private async fetchBidById(id: string): Promise<CustomerBidDto> {
    const rows = await this.prisma.$queryRaw<BaseBidRow[]>(Prisma.sql`
      SELECT
          cbd.id AS "id",
          cbd.sales_type AS "salesType",
          cbd.source_db AS "sourceDb",
          cbd.site_code AS "siteCode",
          c."name" AS "customerName",
          cbd.customer_bill_to AS "customerBillTo",
          c.co_op_code AS "coOpCode",
          cbd.com_co_op_code AS "comCoOpCode",
          c.contact AS "contactName",
          c.e_mail AS "contactEmail",
          c.phone_no_ AS "contactPhone",
          c.salesperson_code AS "salesRep",
          cbd.item_no AS "itemNo",
          i.description AS "itemDescription",
          i.description_2 AS "brandName",
          i.pack_size AS "packSize",
          sku.customer_lead_time AS "customerLeadTime",
          cbd.bid_qty AS "bidQty",
          cbd.bid_start AS "bidStart",
          cbd.bid_end AS "bidEnd",
          cbd.erp_status AS "erpStatus",
          cbd.last_year_bid_qty AS "lastYearBidQty",
          cbd.last_year_actual AS "lastYearActual",
          cbd.ly_august AS "lyAugust",
          cbd.ly_september AS "lySeptember",
          cbd.ly_october AS "lyOctober",
          cbd.ly_november AS "lyNovember",
          cbd.ly_december AS "lyDecember",
          cbd.ly_january AS "lyJanuary",
          cbd.ly_february AS "lyFebruary",
          cbd.ly_march AS "lyMarch",
          cbd.ly_april AS "lyApril",
          cbd.ly_may AS "lyMay",
          cbd.ly_june AS "lyJune",
          cbd.ly_july AS "lyJuly",
          cbd.cy_august AS "cyAugust",
          cbd.cy_september AS "cySeptember",
          cbd.cy_october AS "cyOctober",
          cbd.cy_november AS "cyNovember",
          cbd.cy_december AS "cyDecember",
          cbd.cy_january AS "cyJanuary",
          cbd.cy_february AS "cyFebruary",
          cbd.cy_march AS "cyMarch",
          cbd.cy_april AS "cyApril",
          cbd.cy_may AS "cyMay",
          cbd.cy_june AS "cyJune",
          cbd.cy_july AS "cyJuly",
          cbd.is_new AS "isNew",
          cbd.last_updated_at AS "lastUpdatedAt",
          cbd.last_updated_by AS "lastUpdatedBy",
          cbd.confirmed_at AS "confirmedAt",
          cbd.confirmed_by AS "confirmedBy",
          cbd.last_exported_at AS "lastExportedAt",
          cbd.last_exported_by AS "lastExportedBy",
          cbd.year_around AS "yearAround",
          cbd.estimate_jan AS "estimateJan",
          cbd.estimate_feb AS "estimateFeb",
          cbd.estimate_mar AS "estimateMar",
          cbd.estimate_apr AS "estimateApr",
          cbd.estimate_may AS "estimateMay",
          cbd.estimate_jun AS "estimateJun",
          cbd.estimate_jul AS "estimateJul",
          cbd.estimate_aug AS "estimateAug",
          cbd.estimate_sep AS "estimateSep",
          cbd.estimate_oct AS "estimateOct",
          cbd.estimate_nov AS "estimateNov",
          cbd.estimate_dec AS "estimateDec",
          cbd.open_order_qty AS "openOrderQty"
      FROM ait.customer_bid_data cbd
      INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_
          AND cbd.source_db = c.source_db
      INNER JOIN dw2_nav.item i
          ON cbd.item_no = i.no_
          AND cbd.source_db = i.source_db
      LEFT JOIN dw2_nav.stockkeeping_unit sku
          ON cbd.item_no = sku.item_no_
          AND cbd.source_db = sku.source_db
          AND cbd.site_code = sku.location_code
      WHERE cbd.id = ${id}::uuid
      LIMIT 1
    `);

    if (rows.length === 0) {
      throw new CustomerBidNotFoundError(id);
    }
    return this.mapBaseRowToDto(rows[0]!);
  }

  /**
   * Get paginated customer bid records
   */
  async getCustomerBids(
    query: CustomerBidQueryDto
  ): Promise<CustomerBidListResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 500);
    const offset = (page - 1) * limit;
    const schoolYear = query.schoolYear ?? "next";

    logger.debug(
      { event: "customer-bid.query", query, page, limit, offset, schoolYear },
      "Fetching customer bids"
    );

    try {
      // Calculate school year string for query (e.g., "2025-2026")
      const schoolYearString = getSchoolYearString(schoolYear);

      // Calculate date boundaries for the response dateRange field
      const { startDate, endDate } = getSchoolYearBoundaries(schoolYear);
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);

      logger.debug(
        {
          event: "customer-bid.school-year",
          schoolYear,
          schoolYearString,
        },
        "Querying customer bids by school year"
      );

      // Build WHERE clause conditions from shared filter builder + queued filter
      const whereConditions = buildBidFilterConditions(query);

      if (query.queued !== undefined) {
        const queuedSubquery = Prisma.sql`
          SELECT 1 FROM ait.customer_bid_export_item bei
          WHERE bei.bid_id = cbd.id
            AND bei.status = 'QUEUED'
        `;
        if (query.queued) {
          whereConditions.push(Prisma.sql`EXISTS (${queuedSubquery})`);
        } else {
          whereConditions.push(Prisma.sql`NOT EXISTS (${queuedSubquery})`);
        }
      }

      const additionalWhere =
        whereConditions.length > 0
          ? Prisma.sql`AND ${Prisma.join(whereConditions, " AND ")}`
          : Prisma.empty;

      // Query from pre-aggregated customer_bid_data, joining customer/item for metadata
      const baseQuery = Prisma.sql`
        SELECT
            cbd.id AS "id",
            cbd.sales_type AS "salesType",
            cbd.source_db AS "sourceDb",
            cbd.site_code AS "siteCode",
            c."name" AS "customerName",
            cbd.customer_bill_to AS "customerBillTo",
            c.co_op_code AS "coOpCode",
            cbd.com_co_op_code AS "comCoOpCode",
            c.contact AS "contactName",
            c.e_mail AS "contactEmail",
            c.phone_no_ AS "contactPhone",
            c.salesperson_code AS "salesRep",
            cbd.item_no AS "itemNo",
            i.description AS "itemDescription",
            i.description_2 AS "brandName",
            i.pack_size AS "packSize",
            sku.customer_lead_time AS "customerLeadTime",
            cbd.bid_qty AS "bidQty",
            cbd.bid_start AS "bidStart",
            cbd.bid_end AS "bidEnd",
            cbd.erp_status AS "erpStatus",
            cbd.last_year_bid_qty AS "lastYearBidQty",
            cbd.last_year_actual AS "lastYearActual",
            cbd.ly_august AS "lyAugust",
            cbd.ly_september AS "lySeptember",
            cbd.ly_october AS "lyOctober",
            cbd.ly_november AS "lyNovember",
            cbd.ly_december AS "lyDecember",
            cbd.ly_january AS "lyJanuary",
            cbd.ly_february AS "lyFebruary",
            cbd.ly_march AS "lyMarch",
            cbd.ly_april AS "lyApril",
            cbd.ly_may AS "lyMay",
            cbd.ly_june AS "lyJune",
            cbd.ly_july AS "lyJuly",
            cbd.cy_august AS "cyAugust",
            cbd.cy_september AS "cySeptember",
            cbd.cy_october AS "cyOctober",
            cbd.cy_november AS "cyNovember",
            cbd.cy_december AS "cyDecember",
            cbd.cy_january AS "cyJanuary",
            cbd.cy_february AS "cyFebruary",
            cbd.cy_march AS "cyMarch",
            cbd.cy_april AS "cyApril",
            cbd.cy_may AS "cyMay",
            cbd.cy_june AS "cyJune",
            cbd.cy_july AS "cyJuly",
            cbd.is_new AS "isNew",
            cbd.last_updated_at AS "lastUpdatedAt",
            cbd.last_updated_by AS "lastUpdatedBy",
            cbd.confirmed_at AS "confirmedAt",
            cbd.confirmed_by AS "confirmedBy",
            cbd.last_exported_at AS "lastExportedAt",
            cbd.last_exported_by AS "lastExportedBy",
            cbd.year_around AS "yearAround",
            cbd.estimate_jan AS "estimateJan",
            cbd.estimate_feb AS "estimateFeb",
            cbd.estimate_mar AS "estimateMar",
            cbd.estimate_apr AS "estimateApr",
            cbd.estimate_may AS "estimateMay",
            cbd.estimate_jun AS "estimateJun",
            cbd.estimate_jul AS "estimateJul",
            cbd.estimate_aug AS "estimateAug",
            cbd.estimate_sep AS "estimateSep",
            cbd.estimate_oct AS "estimateOct",
            cbd.estimate_nov AS "estimateNov",
            cbd.estimate_dec AS "estimateDec",
            cbd.open_order_qty AS "openOrderQty"
        FROM ait.customer_bid_data cbd
        INNER JOIN dw2_nav.customer c
            ON cbd.customer_bill_to = c.no_
            AND cbd.source_db = c.source_db
        INNER JOIN dw2_nav.item i
            ON cbd.item_no = i.no_
            AND cbd.source_db = i.source_db
        LEFT JOIN dw2_nav.stockkeeping_unit sku
            ON cbd.item_no = sku.item_no_
            AND cbd.source_db = sku.source_db
            AND cbd.site_code = sku.location_code
        WHERE cbd.school_year = ${schoolYearString}
          ${additionalWhere}
        ORDER BY cbd.site_code, cbd.item_no, cbd.customer_bill_to
        LIMIT ${limit + 1} OFFSET ${offset}
      `;

      const rows = await this.prisma.$queryRaw<BaseBidRow[]>(baseQuery);

      // Calculate hasMore and trim to limit
      const hasMore = rows.length > limit;
      const trimmedRows = hasMore ? rows.slice(0, limit) : rows;

      // Map to DTO via shared mapper
      const data: CustomerBidDto[] = trimmedRows.map((row) =>
        this.mapBaseRowToDto(row)
      );

      logger.info(
        {
          event: "customer-bid.query.success",
          page,
          limit,
          returnedCount: data.length,
          hasMore,
          schoolYear,
          schoolYearString,
        },
        "Customer bids fetched successfully"
      );

      return {
        data,
        pagination: {
          page,
          limit,
          hasMore,
        },
        dateRange: {
          startDate: startDateStr,
          endDate: endDateStr,
        },
      };
    } catch (error) {
      logger.error(
        { event: "customer-bid.query.error", error },
        "Failed to fetch customer bids"
      );

      if (error instanceof CustomerBidDatabaseError) {
        throw error;
      }

      throw new CustomerBidDatabaseError(
        "Failed to fetch customer bids from database",
        error instanceof Error ? error : undefined
      );
    }
  }

  private buildExportWhere(query: CustomerBidQueryDto): {
    schoolYearString: string;
    additionalWhere: Prisma.Sql;
  } {
    const schoolYearString = getSchoolYearString(query.schoolYear ?? "next");
    const whereConditions = buildBidFilterConditions(query);

    if (query.queued !== undefined) {
      const queuedSubquery = Prisma.sql`
        SELECT 1 FROM ait.customer_bid_export_item bei
        WHERE bei.bid_id = cbd.id AND bei.status = 'QUEUED'
      `;
      if (query.queued) {
        whereConditions.push(Prisma.sql`EXISTS (${queuedSubquery})`);
      } else {
        whereConditions.push(Prisma.sql`NOT EXISTS (${queuedSubquery})`);
      }
    }

    const additionalWhere =
      whereConditions.length > 0
        ? Prisma.sql`AND ${Prisma.join(whereConditions, " AND ")}`
        : Prisma.empty;

    return { schoolYearString, additionalWhere };
  }

  async streamCustomerBidsForExport(
    query: CustomerBidQueryDto,
    onBatch: (
      dtos: CustomerBidDto[],
      meta: {
        batch: number;
        rowsSoFar: number;
        total: number;
        truncated: boolean;
      }
    ) => void,
    maxRows: number = 5000
  ): Promise<{
    totalRows: number;
    totalMatching: number;
    truncated: boolean;
  }> {
    const BATCH_SIZE = 500;
    const { schoolYearString, additionalWhere } = this.buildExportWhere(query);

    const [{ count: totalMatching }] = await this.prisma.$queryRaw<
      [{ count: number }]
    >(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM ait.customer_bid_data cbd
      INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_ AND cbd.source_db = c.source_db
      INNER JOIN dw2_nav.item i
          ON cbd.item_no = i.no_ AND cbd.source_db = i.source_db
      LEFT JOIN dw2_nav.stockkeeping_unit sku
          ON cbd.item_no = sku.item_no_ AND cbd.source_db = sku.source_db
          AND cbd.site_code = sku.location_code
      WHERE cbd.school_year = ${schoolYearString}
        ${additionalWhere}
    `);

    logger.info(
      { event: "customer-bid.export.count", totalMatching, maxRows },
      "Export count check complete"
    );

    if (totalMatching === 0) {
      return { totalRows: 0, totalMatching: 0, truncated: false };
    }

    if (totalMatching > maxRows) {
      throw new CustomerBidQueryError(
        `Export exceeds the maximum of ${maxRows.toLocaleString()} rows (${totalMatching.toLocaleString()} matched). Please narrow your filters.`
      );
    }

    const effectiveLimit = totalMatching;

    const selectFragment = Prisma.sql`
      SELECT
          cbd.id AS "id",
          cbd.sales_type AS "salesType",
          cbd.source_db AS "sourceDb",
          cbd.site_code AS "siteCode",
          c."name" AS "customerName",
          cbd.customer_bill_to AS "customerBillTo",
          c.co_op_code AS "coOpCode",
          cbd.com_co_op_code AS "comCoOpCode",
          c.contact AS "contactName",
          c.e_mail AS "contactEmail",
          c.phone_no_ AS "contactPhone",
          c.salesperson_code AS "salesRep",
          cbd.item_no AS "itemNo",
          i.description AS "itemDescription",
          i.description_2 AS "brandName",
          i.pack_size AS "packSize",
          sku.customer_lead_time AS "customerLeadTime",
          cbd.bid_qty AS "bidQty",
          cbd.bid_start AS "bidStart",
          cbd.bid_end AS "bidEnd",
          cbd.erp_status AS "erpStatus",
          cbd.last_year_bid_qty AS "lastYearBidQty",
          cbd.last_year_actual AS "lastYearActual",
          cbd.ly_august AS "lyAugust",
          cbd.ly_september AS "lySeptember",
          cbd.ly_october AS "lyOctober",
          cbd.ly_november AS "lyNovember",
          cbd.ly_december AS "lyDecember",
          cbd.ly_january AS "lyJanuary",
          cbd.ly_february AS "lyFebruary",
          cbd.ly_march AS "lyMarch",
          cbd.ly_april AS "lyApril",
          cbd.ly_may AS "lyMay",
          cbd.ly_june AS "lyJune",
          cbd.ly_july AS "lyJuly",
          cbd.cy_august AS "cyAugust",
          cbd.cy_september AS "cySeptember",
          cbd.cy_october AS "cyOctober",
          cbd.cy_november AS "cyNovember",
          cbd.cy_december AS "cyDecember",
          cbd.cy_january AS "cyJanuary",
          cbd.cy_february AS "cyFebruary",
          cbd.cy_march AS "cyMarch",
          cbd.cy_april AS "cyApril",
          cbd.cy_may AS "cyMay",
          cbd.cy_june AS "cyJune",
          cbd.cy_july AS "cyJuly",
          cbd.is_new AS "isNew",
          cbd.last_updated_at AS "lastUpdatedAt",
          cbd.last_updated_by AS "lastUpdatedBy",
          cbd.confirmed_at AS "confirmedAt",
          cbd.confirmed_by AS "confirmedBy",
          cbd.last_exported_at AS "lastExportedAt",
          cbd.last_exported_by AS "lastExportedBy",
          cbd.year_around AS "yearAround",
          cbd.estimate_jan AS "estimateJan",
          cbd.estimate_feb AS "estimateFeb",
          cbd.estimate_mar AS "estimateMar",
          cbd.estimate_apr AS "estimateApr",
          cbd.estimate_may AS "estimateMay",
          cbd.estimate_jun AS "estimateJun",
          cbd.estimate_jul AS "estimateJul",
          cbd.estimate_aug AS "estimateAug",
          cbd.estimate_sep AS "estimateSep",
          cbd.estimate_oct AS "estimateOct",
          cbd.estimate_nov AS "estimateNov",
          cbd.estimate_dec AS "estimateDec",
          cbd.open_order_qty AS "openOrderQty"
      FROM ait.customer_bid_data cbd
      INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_ AND cbd.source_db = c.source_db
      INNER JOIN dw2_nav.item i
          ON cbd.item_no = i.no_ AND cbd.source_db = i.source_db
      LEFT JOIN dw2_nav.stockkeeping_unit sku
          ON cbd.item_no = sku.item_no_ AND cbd.source_db = sku.source_db
          AND cbd.site_code = sku.location_code
      WHERE cbd.school_year = ${schoolYearString}
        ${additionalWhere}
      ORDER BY cbd.site_code, cbd.item_no, cbd.customer_bill_to
    `;

    if (effectiveLimit <= BATCH_SIZE) {
      const rows = await this.prisma.$queryRaw<BaseBidRow[]>(
        Prisma.sql`${selectFragment} LIMIT ${effectiveLimit}`
      );
      const dtos = rows.map((row) => this.mapBaseRowToDto(row));
      onBatch(dtos, {
        batch: 1,
        rowsSoFar: dtos.length,
        total: effectiveLimit,
        truncated: false,
      });
      return { totalRows: dtos.length, totalMatching, truncated: false };
    }

    let totalRows = 0;
    let batchNum = 0;

    const rows = await this.prisma.$queryRaw<BaseBidRow[]>(
      Prisma.sql`${selectFragment} LIMIT ${effectiveLimit}`
    );

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      batchNum++;
      totalRows += batch.length;
      const dtos = batch.map((row) => this.mapBaseRowToDto(row));
      onBatch(dtos, {
        batch: batchNum,
        rowsSoFar: totalRows,
        total: effectiveLimit,
        truncated: false,
      });
    }

    logger.info(
      { event: "customer-bid.export.complete", totalRows, totalMatching },
      "Export stream complete"
    );

    return { totalRows, totalMatching, truncated: false };
  }

  /**
   * Update user-editable fields on a customer bid record
   */
  async updateBid(
    key: CustomerBidKeyDto,
    data: UpdateCustomerBidDto,
    userEmail: string,
    userGroups: string[] = []
  ): Promise<CustomerBidDto> {
    logger.debug(
      { event: "customer-bid.update", key, data },
      "Updating customer bid"
    );

    try {
      // Check if bid exists and is confirmed — enforce restrictions
      const existing = await this.prisma.customerBidData.findUnique({
        where: { id: key.id },
      });

      if (!existing) {
        throw new CustomerBidNotFoundError(key.id);
      }

      if (existing.confirmedAt) {
        // Reject yearAround changes on confirmed bids (all roles)
        if (data.yearAround !== undefined) {
          throw new CustomerBidQueryError(
            "Cannot update Year Around on a confirmed bid"
          );
        }

        // Reject estimate changes on confirmed bids for SALES-only users
        const userRoles = await this.rbacService.resolveRoles(userGroups);
        const isSalesOnly =
          userRoles.some((r) => r.enumKey === Role.SALES) &&
          !userRoles.some(
            (r) => r.enumKey === Role.ADMIN || r.enumKey === Role.DEMAND_PLANNER
          );

        if (isSalesOnly) {
          const hasEstimateChange = ESTIMATE_FIELDS.some(
            (field) => data[field as keyof UpdateCustomerBidDto] !== undefined
          );
          if (hasEstimateChange) {
            throw new CustomerBidQueryError(
              "Cannot update estimates on a confirmed bid"
            );
          }
        }
      }

      const now = new Date();

      // Plain update - new rows are exclusively created by the sync function
      await this.prisma.customerBidData.update({
        where: { id: key.id },
        data: {
          yearAround: data.yearAround,
          lastUpdatedAt: now,
          lastUpdatedBy: userEmail,
          // Monthly estimates
          estimateJan: data.estimateJan,
          estimateFeb: data.estimateFeb,
          estimateMar: data.estimateMar,
          estimateApr: data.estimateApr,
          estimateMay: data.estimateMay,
          estimateJun: data.estimateJun,
          estimateJul: data.estimateJul,
          estimateAug: data.estimateAug,
          estimateSep: data.estimateSep,
          estimateOct: data.estimateOct,
          estimateNov: data.estimateNov,
          estimateDec: data.estimateDec,
        },
      });

      logger.info(
        { event: "customer-bid.update.success", key },
        "Customer bid updated successfully"
      );

      return this.fetchBidById(key.id);
    } catch (error) {
      if (
        error instanceof CustomerBidQueryError ||
        error instanceof CustomerBidNotFoundError
      ) {
        throw error;
      }

      logger.error(
        { event: "customer-bid.update.error", key, error },
        "Failed to update customer bid"
      );

      throw new CustomerBidDatabaseError(
        "Failed to update customer bid",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Check if any editable fields in the incoming update differ from the existing record.
   * Returns true if at least one field has actually changed.
   */
  private hasEditableChanges(
    existing: CustomerBidData,
    incoming: UpdateCustomerBidDto
  ): boolean {
    // yearAround
    if (
      incoming.yearAround !== undefined &&
      incoming.yearAround !== existing.yearAround
    )
      return true;

    // Monthly estimates (Prisma Decimal vs number comparison)
    for (const field of ESTIMATE_FIELDS) {
      const inc = incoming[field];
      if (inc === undefined) continue;
      const ext = existing[field];
      if (ext === null && inc === null) continue;
      if (ext === null || inc === null) return true;
      if (ext.toNumber() !== inc) return true;
    }

    return false;
  }

  /**
   * Preview which records in a bulk update would actually change.
   * Uses a single findMany query for efficiency (read-only, no writes).
   */
  async previewBulkUpdate(
    data: BulkUpdateCustomerBidDto
  ): Promise<BulkUpdatePreviewResultDto> {
    logger.debug(
      { event: "customer-bid.bulk-preview", recordCount: data.records.length },
      "Previewing bulk update"
    );

    const ids = data.records.map((r) => r.id);

    const existingRecords = await this.prisma.customerBidData.findMany({
      where: { id: { in: ids } },
    });

    // Build lookup map keyed by UUID
    const existingMap = new Map<string, CustomerBidData>();
    for (const rec of existingRecords) {
      existingMap.set(rec.id, rec);
    }

    let changed = 0;
    let unchanged = 0;
    const changedKeys: string[] = [];

    for (const record of data.records) {
      const existing = existingMap.get(record.id);

      // Records that don't exist in the DB are counted as "would-fail" — flag as
      // changed so the UI surfaces them, the bulk-update path will then error.
      if (!existing) {
        changed++;
        changedKeys.push(record.id);
        continue;
      }

      let needsConfirmChange = false;
      if (record.confirmed === true && !existing.confirmedAt) {
        needsConfirmChange = true;
      } else if (record.confirmed === false && existing.confirmedAt) {
        needsConfirmChange = true;
      }

      const needsFieldUpdate = this.hasEditableChanges(existing, record);

      if (needsFieldUpdate || needsConfirmChange) {
        changed++;
        changedKeys.push(record.id);
      } else {
        unchanged++;
      }
    }

    logger.info(
      { event: "customer-bid.bulk-preview.complete", changed, unchanged },
      "Bulk preview completed"
    );

    return { changed, unchanged, changedKeys };
  }

  /**
   * Bulk update user-editable fields on multiple customer bid records
   */
  async bulkUpdateBids(
    data: BulkUpdateCustomerBidDto,
    userEmail: string
  ): Promise<BulkUpdateResultDto> {
    logger.debug(
      { event: "customer-bid.bulk-update", recordCount: data.records.length },
      "Bulk updating customer bids"
    );

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ key: string; message: string }> = [];

    for (const record of data.records) {
      const key = { id: record.id };

      try {
        // Fetch existing record to check for actual changes
        const existing = await this.prisma.customerBidData.findUnique({
          where: { id: record.id },
        });

        if (!existing) {
          failed++;
          errors.push({
            key: record.id,
            message: "Record not found",
          });
          continue;
        }

        let needsConfirmChange = false;
        if (record.confirmed === true && !existing.confirmedAt) {
          needsConfirmChange = true;
        } else if (record.confirmed === false && existing.confirmedAt) {
          needsConfirmChange = true;
        }

        const needsFieldUpdate = this.hasEditableChanges(existing, record);

        // Skip if nothing actually changed
        if (!needsFieldUpdate && !needsConfirmChange) {
          skipped++;
          continue;
        }

        // If unconfirming, do it first so updateBid won't reject field changes
        if (record.confirmed === false) {
          try {
            await this.unconfirmBid(key);
          } catch (unconfirmError) {
            errors.push({
              key: record.id,
              message: `Unconfirm failed: ${unconfirmError instanceof Error ? unconfirmError.message : "Unknown error"}`,
            });
          }
        }

        // Only call updateBid if editable fields actually changed
        if (needsFieldUpdate) {
          await this.updateBid(
            key,
            {
              yearAround: record.yearAround,
              // Monthly estimates
              estimateJan: record.estimateJan,
              estimateFeb: record.estimateFeb,
              estimateMar: record.estimateMar,
              estimateApr: record.estimateApr,
              estimateMay: record.estimateMay,
              estimateJun: record.estimateJun,
              estimateJul: record.estimateJul,
              estimateAug: record.estimateAug,
              estimateSep: record.estimateSep,
              estimateOct: record.estimateOct,
              estimateNov: record.estimateNov,
              estimateDec: record.estimateDec,
            },
            userEmail
          );
        }
        updated++;

        // If confirming, do it after fields are saved (confirm validates estimates + menus)
        if (record.confirmed === true) {
          try {
            await this.confirmBid(key, userEmail);
          } catch (confirmError) {
            errors.push({
              key: record.id,
              message: `Fields updated but confirmation failed: ${confirmError instanceof Error ? confirmError.message : "Unknown error"}`,
            });
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          key: record.id,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(
      { event: "customer-bid.bulk-update.complete", updated, skipped, failed },
      "Bulk update completed"
    );

    return {
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async confirmBid(
    key: CustomerBidKeyDto,
    userEmail: string
  ): Promise<CustomerBidDto> {
    logger.debug(
      { event: "customer-bid.confirm", key, userEmail },
      "Confirming customer bid"
    );

    try {
      // Validate: at least 1 month must have an estimate > 0
      const existing = await this.prisma.customerBidData.findUnique({
        where: { id: key.id },
      });

      if (!existing) {
        throw new CustomerBidNotFoundError(key.id);
      }

      const hasValidMonth = ESTIMATE_FIELDS.some(
        (field) => existing[field] != null && Number(existing[field]) > 0
      );

      if (!hasValidMonth) {
        throw new CustomerBidQueryError(
          "Cannot confirm: at least one month must have an estimate greater than 0"
        );
      }

      await this.prisma.customerBidData.update({
        where: { id: key.id },
        data: {
          confirmedBy: userEmail,
          confirmedAt: new Date(),
        },
      });

      logger.info(
        { event: "customer-bid.confirm.success", key },
        "Customer bid confirmed"
      );

      return this.fetchBidById(key.id);
    } catch (error) {
      if (
        error instanceof CustomerBidQueryError ||
        error instanceof CustomerBidNotFoundError
      ) {
        throw error;
      }
      logger.error(
        { event: "customer-bid.confirm.error", key, error },
        "Failed to confirm customer bid"
      );

      throw new CustomerBidDatabaseError(
        "Failed to confirm customer bid",
        error instanceof Error ? error : undefined
      );
    }
  }

  async unconfirmBid(key: CustomerBidKeyDto): Promise<CustomerBidDto> {
    logger.debug(
      { event: "customer-bid.unconfirm", key },
      "Unconfirming customer bid"
    );

    try {
      await this.prisma.customerBidData.update({
        where: { id: key.id },
        data: {
          confirmedBy: null,
          confirmedAt: null,
        },
      });

      logger.info(
        { event: "customer-bid.unconfirm.success", key },
        "Customer bid unconfirmed"
      );

      return this.fetchBidById(key.id);
    } catch (error) {
      if (error instanceof CustomerBidNotFoundError) {
        throw error;
      }
      logger.error(
        { event: "customer-bid.unconfirm.error", key, error },
        "Failed to unconfirm customer bid"
      );

      throw new CustomerBidDatabaseError(
        "Failed to unconfirm customer bid",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Trigger a sync operation to populate/refresh calculated fields
   */
  async sync(
    schoolYear: SchoolYear,
    triggeredBy: "manual" | "scheduled"
  ): Promise<SyncResultDto> {
    const syncId = crypto.randomUUID();
    const startTime = Date.now();
    const schoolYearString = getSchoolYearString(schoolYear);

    logger.info(
      { event: "customer-bid.sync.start", syncId, schoolYear, triggeredBy },
      "Starting customer bid sync"
    );

    // Check if there's already a sync in progress (within last 2 hours)
    const staleThresholdMs = 2 * 60 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - staleThresholdMs);

    // Mark any stale IN_PROGRESS syncs (older than threshold) as FAILED
    const staleResult = await this.prisma.customerBidSyncLog.updateMany({
      where: {
        status: "IN_PROGRESS",
        startedAt: { lt: staleThreshold },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          "Sync was automatically marked as failed: process appears to have crashed or timed out (exceeded 2-hour threshold)",
      },
    });

    if (staleResult.count > 0) {
      logger.warn(
        {
          event: "customer-bid.sync.stale-cleanup",
          syncId,
          staleCount: staleResult.count,
        },
        `Marked ${staleResult.count} stale IN_PROGRESS sync(s) as FAILED`
      );
    }

    // Check if there's a recent (non-stale) sync still in progress
    const inProgress = await this.prisma.customerBidSyncLog.findFirst({
      where: {
        status: "IN_PROGRESS",
        startedAt: { gte: staleThreshold },
      },
    });

    if (inProgress) {
      throw new CustomerBidSyncInProgressError();
    }

    // Create sync log entry
    await this.prisma.customerBidSyncLog.create({
      data: {
        id: syncId,
        status: "IN_PROGRESS",
        schoolYear: schoolYearString,
        triggeredBy,
      },
    });

    try {
      // Get current and previous year boundaries
      const { startDate, endDate } = getSchoolYearBoundaries(schoolYear);
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);

      // Calculate "last year" boundaries (one year before)
      const lastYearStart = new Date(
        startDate.getFullYear() - 1,
        startDate.getMonth(),
        startDate.getDate()
      );
      const lastYearEnd = new Date(
        endDate.getFullYear() - 1,
        endDate.getMonth(),
        endDate.getDate()
      );
      const lastYearStartStr = lastYearStart.toISOString().slice(0, 10);
      const lastYearEndStr = lastYearEnd.toISOString().slice(0, 10);

      logger.debug(
        {
          event: "customer-bid.sync.dates",
          syncId,
          current: { start: startDateStr, end: endDateStr },
          lastYear: { start: lastYearStartStr, end: lastYearEndStr },
        },
        "Calculated sync date ranges"
      );

      // Execute the entire sync inside PostgreSQL — no data transferred to Node.js.
      // The DB function handles: current year bids, last year bids, last year sales,
      // ERP status lookups, lost bid detection, and all upserts.
      const [result] = await this.prisma.$queryRaw<
        Array<{
          records_inserted: number;
          records_updated: number;
          records_total: number;
          won_count: number;
          lost_count: number;
        }>
      >(Prisma.sql`
        SELECT * FROM ait.sync_customer_bids(
          ${schoolYearString},
          ${startDateStr}::date,
          ${endDateStr}::date,
          ${lastYearStartStr}::date,
          ${lastYearEndStr}::date
        )
      `);

      const recordsInserted = Number(result?.records_inserted ?? 0);
      const recordsUpdated = Number(result?.records_updated ?? 0);
      const totalRecords = Number(result?.records_total ?? 0);
      const wonBids = Number(result?.won_count ?? 0);
      const lostBids = Number(result?.lost_count ?? 0);

      const durationMs = Date.now() - startTime;

      // Update sync log with success
      await this.prisma.customerBidSyncLog.update({
        where: { id: syncId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          recordsTotal: totalRecords,
          recordsInserted,
          recordsUpdated,
          durationMs,
        },
      });

      logger.info(
        {
          event: "customer-bid.sync.complete",
          syncId,
          recordsTotal: totalRecords,
          wonBids,
          lostBids,
          recordsInserted,
          recordsUpdated,
          durationMs,
        },
        "Customer bid sync completed successfully"
      );

      return {
        syncId,
        status: "COMPLETED",
        schoolYear: schoolYearString,
        recordsTotal: totalRecords,
        recordsInserted,
        recordsUpdated,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update sync log with failure
      await this.prisma.customerBidSyncLog.update({
        where: { id: syncId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage,
          durationMs,
        },
      });

      logger.error(
        { event: "customer-bid.sync.failed", syncId, error: errorMessage },
        "Customer bid sync failed"
      );

      throw error;
    }
  }

  /**
   * Get the latest sync status
   */
  async getSyncStatus(): Promise<SyncLogDto | null> {
    const log = await this.prisma.customerBidSyncLog.findFirst({
      orderBy: { startedAt: "desc" },
    });

    return log ? this.toSyncLogDto(log) : null;
  }

  /**
   * Get sync history
   */
  async getSyncHistory(limit = 20): Promise<SyncLogDto[]> {
    const logs = await this.prisma.customerBidSyncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return logs.map((log) => this.toSyncLogDto(log));
  }

  /**
   * Get aggregate statistics for customer bids matching the given filters.
   * Returns total/confirmed counts overall and per location.
   */
  async getStats(query: CustomerBidQueryDto): Promise<CustomerBidStatsDto> {
    const schoolYear = query.schoolYear ?? "next";
    const schoolYearString = getSchoolYearString(schoolYear);

    try {
      const whereConditions = buildBidFilterConditions(query);

      if (query.queued !== undefined) {
        const queuedSubquery = Prisma.sql`
          SELECT 1 FROM ait.customer_bid_export_item bei
          WHERE bei.bid_id = cbd.id
            AND bei.status = 'QUEUED'
        `;
        if (query.queued) {
          whereConditions.push(Prisma.sql`EXISTS (${queuedSubquery})`);
        } else {
          whereConditions.push(Prisma.sql`NOT EXISTS (${queuedSubquery})`);
        }
      }

      const additionalWhere =
        whereConditions.length > 0
          ? Prisma.sql`AND ${Prisma.join(whereConditions, " AND ")}`
          : Prisma.empty;

      const rows = await this.prisma.$queryRaw<
        { siteCode: string; total: number; confirmed: number }[]
      >(Prisma.sql`
        SELECT
          cbd.site_code AS "siteCode",
          COUNT(*)::int AS "total",
          COUNT(cbd.confirmed_at)::int AS "confirmed"
        FROM ait.customer_bid_data cbd
        INNER JOIN dw2_nav.customer c
          ON cbd.customer_bill_to = c.no_
          AND cbd.source_db = c.source_db
        WHERE cbd.school_year = ${schoolYearString}
          ${additionalWhere}
        GROUP BY cbd.site_code
        ORDER BY cbd.site_code
      `);

      let totalItems = 0;
      let confirmedItems = 0;
      for (const row of rows) {
        totalItems += row.total;
        confirmedItems += row.confirmed;
      }

      return {
        totalItems,
        confirmedItems,
        byLocation: rows,
      };
    } catch (error) {
      logger.error(
        { event: "customer-bid.stats.error", error },
        "Failed to fetch customer bid stats"
      );
      throw new CustomerBidDatabaseError(
        "Failed to retrieve customer bid statistics"
      );
    }
  }

  /**
   * Get distinct filter option values for autocomplete suggestions.
   * Queries all distinct values globally (not scoped by school year).
   */
  async getFilterOptions(): Promise<CustomerBidFilterOptionsDto> {
    try {
      const rows = await this.prisma.$queryRaw<
        { field: string; value: string }[]
      >(Prisma.sql`
        SELECT 'siteCode' AS "field", location_code AS "value"
        FROM (SELECT DISTINCT location_code FROM dw2_nav.customer WHERE location_code IS NOT NULL AND location_code != '' ORDER BY 1) t
        UNION ALL
        SELECT 'salesRep', salesperson_code
        FROM (SELECT DISTINCT salesperson_code FROM dw2_nav.customer WHERE salesperson_code IS NOT NULL AND salesperson_code != '' ORDER BY 1) t
        UNION ALL
        SELECT 'erpStatus', erp_status
        FROM (SELECT DISTINCT erp_status FROM ait.customer_bid_data WHERE erp_status IS NOT NULL AND erp_status != '' ORDER BY 1) t
        UNION ALL
        SELECT 'coOpCode', co_op_code
        FROM (SELECT DISTINCT co_op_code FROM dw2_nav.customer WHERE co_op_code IS NOT NULL AND co_op_code != '' ORDER BY 1) t
        UNION ALL
        SELECT 'comCoOpCode', com_co_op_code
        FROM (SELECT DISTINCT com_co_op_code FROM ait.customer_bid_data WHERE com_co_op_code IS NOT NULL AND com_co_op_code != '' ORDER BY 1) t
      `);

      const grouped: Record<string, string[]> = {};
      for (const row of rows) {
        (grouped[row.field] ??= []).push(row.value);
      }

      return {
        siteCodes: grouped["siteCode"] ?? [],
        salesReps: grouped["salesRep"] ?? [],
        erpStatuses: grouped["erpStatus"] ?? [],
        coOpCodes: grouped["coOpCode"] ?? [],
        comCoOpCodes: grouped["comCoOpCode"] ?? [],
      };
    } catch (error) {
      logger.error(
        { event: "customer-bid.filter-options.error", error },
        "Failed to fetch filter options"
      );
      throw new CustomerBidDatabaseError(
        "Failed to fetch filter options from database",
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Map sync log to DTO
   */
  private toSyncLogDto(log: {
    id: string;
    status: string;
    schoolYear: string;
    startedAt: Date;
    completedAt: Date | null;
    recordsTotal: number | null;
    recordsInserted: number | null;
    recordsUpdated: number | null;
    errorMessage: string | null;
    durationMs: number | null;
    triggeredBy: string;
  }): SyncLogDto {
    return {
      id: log.id,
      status: log.status,
      schoolYear: log.schoolYear,
      startedAt: log.startedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
      recordsTotal: log.recordsTotal,
      recordsInserted: log.recordsInserted,
      recordsUpdated: log.recordsUpdated,
      errorMessage: log.errorMessage,
      durationMs: log.durationMs,
      triggeredBy: log.triggeredBy,
    };
  }
}
