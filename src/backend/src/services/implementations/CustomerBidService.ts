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
  SyncResultDto,
  SyncLogDto,
  SchoolYear,
} from "@/contracts/dtos/customer-bid.dto";
import {
  CustomerBidDatabaseError,
  CustomerBidQueryError,
  CustomerBidSyncInProgressError,
} from "@/utils/errors/customer-bid-errors";
import { createChildLogger } from "@/telemetry/logger";
import { IRbacService, RBAC_SERVICE_TOKEN } from "@/services/IRbacService";
import { Role } from "@/contracts/rbac/role";
import { buildCompositeKeyWhere } from "@/services/helpers/bid-keys";
import {
  ESTIMATE_FIELDS,
  decimalToNumber,
  mapEstimates,
} from "@/services/helpers/bid-converters";
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
  sourceDb: string | null;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  coOpCode: string | null;
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
   * Get paginated customer bid records
   */
  async getCustomerBids(
    query: CustomerBidQueryDto
  ): Promise<CustomerBidListResponseDto> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);
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
          WHERE bei.source_db = cbd.source_db
            AND bei.site_code = cbd.site_code
            AND bei.customer_bill_to = cbd.customer_bill_to
            AND bei.item_no = cbd.item_no
            AND bei.school_year = cbd.school_year
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
            cbd.source_db AS "sourceDb",
            cbd.site_code AS "siteCode",
            c."name" AS "customerName",
            cbd.customer_bill_to AS "customerBillTo",
            c.co_op_code AS "coOpCode",
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
            cbd.estimate_dec AS "estimateDec"
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

      // Map to DTO
      const data: CustomerBidDto[] = trimmedRows.map((row) => ({
        sourceDb: row.sourceDb,
        siteCode: row.siteCode,
        customerName: row.customerName,
        customerBillTo: row.customerBillTo,
        coOpCode: row.coOpCode,
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
      }));

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
      const compositeKey = buildCompositeKeyWhere(key);

      // Check if bid is confirmed — enforce restrictions
      const existing = await this.prisma.customerBidData.findUnique({
        where: compositeKey,
      });

      if (existing?.confirmedAt) {
        // Reject yearAround changes on confirmed bids (all roles)
        if (data.yearAround !== undefined) {
          throw new CustomerBidQueryError(
            "Cannot update Year Around on a confirmed bid"
          );
        }

        // Reject estimate changes on confirmed bids for SALES-only users
        const userRoles = this.rbacService.resolveRoles(userGroups);
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

      // Upsert the record - create if not exists, update if exists
      const record = await this.prisma.customerBidData.upsert({
        where: compositeKey,
        create: {
          sourceDb: key.sourceDb,
          siteCode: key.siteCode,
          customerBillTo: key.customerBillTo,
          itemNo: key.itemNo,
          schoolYear: key.schoolYear,
          yearAround: data.yearAround ?? false,
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
        update: {
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

      return this.recordToDto(record);
    } catch (error) {
      if (error instanceof CustomerBidQueryError) {
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
   * Check if an incoming update has any non-default values worth writing.
   * Used when no existing DB record exists — only create if there's real data.
   */
  private hasNonDefaultValues(incoming: UpdateCustomerBidDto): boolean {
    if (incoming.yearAround === true) return true;

    for (const f of ESTIMATE_FIELDS) {
      if (incoming[f] !== undefined && incoming[f] !== null) return true;
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

    // Build OR conditions for a single batch query
    const orConditions = data.records.map((r) => ({
      sourceDb: r.sourceDb,
      siteCode: r.siteCode,
      customerBillTo: r.customerBillTo,
      itemNo: r.itemNo,
      schoolYear: r.schoolYear,
    }));

    const existingRecords = await this.prisma.customerBidData.findMany({
      where: { OR: orConditions },
    });

    // Build lookup map: "sourceDb/siteCode/customerBillTo/itemNo/schoolYear" → record
    const existingMap = new Map<string, CustomerBidData>();
    for (const rec of existingRecords) {
      const key = `${rec.sourceDb}/${rec.siteCode}/${rec.customerBillTo}/${rec.itemNo}/${rec.schoolYear}`;
      existingMap.set(key, rec);
    }

    let changed = 0;
    let unchanged = 0;
    const changedKeys: string[] = [];

    for (const record of data.records) {
      const keyStr = `${record.sourceDb}/${record.siteCode}/${record.customerBillTo}/${record.itemNo}/${record.schoolYear}`;
      const existing = existingMap.get(keyStr);

      let needsConfirmChange = false;
      if (record.confirmed === true && !existing?.confirmedAt) {
        needsConfirmChange = true;
      } else if (record.confirmed === false && existing?.confirmedAt) {
        needsConfirmChange = true;
      }

      const needsFieldUpdate = existing
        ? this.hasEditableChanges(existing, record)
        : this.hasNonDefaultValues(record);

      if (needsFieldUpdate || needsConfirmChange) {
        changed++;
        changedKeys.push(keyStr);
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
      const key = {
        sourceDb: record.sourceDb,
        siteCode: record.siteCode,
        customerBillTo: record.customerBillTo,
        itemNo: record.itemNo,
        schoolYear: record.schoolYear,
      };
      const keyStr = `${key.sourceDb}/${key.siteCode}/${key.customerBillTo}/${key.itemNo}/${key.schoolYear}`;

      try {
        // Fetch existing record to check for actual changes
        const existing = await this.prisma.customerBidData.findUnique({
          where: buildCompositeKeyWhere(key),
        });

        let needsConfirmChange = false;
        if (record.confirmed === true && !existing?.confirmedAt) {
          needsConfirmChange = true;
        } else if (record.confirmed === false && existing?.confirmedAt) {
          needsConfirmChange = true;
        }

        const needsFieldUpdate = existing
          ? this.hasEditableChanges(existing, record)
          : this.hasNonDefaultValues(record);

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
              key: keyStr,
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
              key: keyStr,
              message: `Fields updated but confirmation failed: ${confirmError instanceof Error ? confirmError.message : "Unknown error"}`,
            });
          }
        }
      } catch (error) {
        failed++;
        errors.push({
          key: keyStr,
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

  /**
   * Map a CustomerBidData Prisma record to a minimal CustomerBidDto
   */
  private recordToDto(record: {
    sourceDb: string;
    siteCode: string;
    customerBillTo: string;
    itemNo: string;
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
    isNew: boolean;
    lastUpdatedAt: Date | null;
    lastUpdatedBy: string | null;
    confirmedAt: Date | null;
    confirmedBy: string | null;
    lastExportedAt: Date | null;
    lastExportedBy: string | null;
    yearAround: boolean;
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
  }): CustomerBidDto {
    return {
      sourceDb: record.sourceDb,
      siteCode: record.siteCode,
      customerName: null,
      customerBillTo: record.customerBillTo,
      coOpCode: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      salesRep: null,
      bidStartDate: "",
      bidEndDate: null,
      itemCode: record.itemNo,
      itemDescription: null,
      brandName: null,
      packSize: null,
      customerLeadTime: null,
      erpStatus: null,
      bidQuantity: null,
      lastYearBidQty: decimalToNumber(record.lastYearBidQty),
      lastYearActual: decimalToNumber(record.lastYearActual),
      lyAugust: decimalToNumber(record.lyAugust),
      lySeptember: decimalToNumber(record.lySeptember),
      lyOctober: decimalToNumber(record.lyOctober),
      lyNovember: decimalToNumber(record.lyNovember),
      lyDecember: decimalToNumber(record.lyDecember),
      lyJanuary: decimalToNumber(record.lyJanuary),
      lyFebruary: decimalToNumber(record.lyFebruary),
      lyMarch: decimalToNumber(record.lyMarch),
      lyApril: decimalToNumber(record.lyApril),
      lyMay: decimalToNumber(record.lyMay),
      lyJune: decimalToNumber(record.lyJune),
      lyJuly: decimalToNumber(record.lyJuly),
      isNew: record.isNew,
      lastUpdatedAt: record.lastUpdatedAt?.toISOString() ?? null,
      lastUpdatedBy: record.lastUpdatedBy ?? null,
      confirmedAt: record.confirmedAt?.toISOString() ?? null,
      confirmedBy: record.confirmedBy ?? null,
      lastExportedAt: record.lastExportedAt?.toISOString() ?? null,
      lastExportedBy: record.lastExportedBy ?? null,
      yearAround: record.yearAround,
      ...mapEstimates(record),
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
      // Validate: at least 1 month must have both an estimate and a menu month
      const existing = await this.prisma.customerBidData.findUnique({
        where: buildCompositeKeyWhere(key),
      });

      if (!existing) {
        throw new CustomerBidQueryError(
          "Cannot confirm: no estimate data exists for this bid"
        );
      }

      const hasValidMonth = ESTIMATE_FIELDS.some(
        (field) => existing[field] != null && Number(existing[field]) > 0
      );

      if (!hasValidMonth) {
        throw new CustomerBidQueryError(
          "Cannot confirm: at least one month must have an estimate greater than 0"
        );
      }

      const record = await this.prisma.customerBidData.update({
        where: buildCompositeKeyWhere(key),
        data: {
          confirmedBy: userEmail,
          confirmedAt: new Date(),
        },
      });

      logger.info(
        { event: "customer-bid.confirm.success", key },
        "Customer bid confirmed"
      );

      return this.recordToDto(record);
    } catch (error) {
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
      const record = await this.prisma.customerBidData.update({
        where: buildCompositeKeyWhere(key),
        data: {
          confirmedBy: null,
          confirmedAt: null,
        },
      });

      logger.info(
        { event: "customer-bid.unconfirm.success", key },
        "Customer bid unconfirmed"
      );

      return this.recordToDto(record);
    } catch (error) {
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
