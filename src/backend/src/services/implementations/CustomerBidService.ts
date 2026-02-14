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
  isLost: boolean | null;
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
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

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
      const schoolYearString = this.getSchoolYearString(schoolYear);

      // Calculate date boundaries for the response dateRange field
      const { startDate, endDate } = this.getSchoolYearBoundaries(schoolYear);
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

      // Build WHERE clause conditions for filters
      const whereConditions: Prisma.Sql[] = [];

      if (query.siteCode) {
        whereConditions.push(Prisma.sql`cbd.site_code = ${query.siteCode}`);
      }

      if (query.customerBillTo) {
        whereConditions.push(
          Prisma.sql`cbd.customer_bill_to ILIKE ${"%" + query.customerBillTo + "%"}`
        );
      }

      if (query.customerName) {
        whereConditions.push(
          Prisma.sql`c."name" ILIKE ${"%" + query.customerName + "%"}`
        );
      }

      if (query.salesRep) {
        whereConditions.push(
          Prisma.sql`c.salesperson_code = ${query.salesRep}`
        );
      }

      if (query.itemCode) {
        whereConditions.push(Prisma.sql`cbd.item_no = ${query.itemCode}`);
      }

      if (query.erpStatus) {
        whereConditions.push(
          Prisma.sql`cbd.erp_status ILIKE ${"%" + query.erpStatus + "%"}`
        );
      }

      if (query.sourceDb) {
        whereConditions.push(Prisma.sql`cbd.source_db = ${query.sourceDb}`);
      }

      if (query.coOpCode) {
        whereConditions.push(Prisma.sql`c.co_op_code = ${query.coOpCode}`);
      }

      if (query.isLost !== undefined) {
        whereConditions.push(Prisma.sql`cbd.is_lost = ${query.isLost}`);
      }

      // Filter out rows with NULL bid dates unless explicitly viewing lost bids
      if (query.isLost !== true) {
        whereConditions.push(
          Prisma.sql`cbd.bid_start IS NOT NULL AND cbd.bid_end IS NOT NULL`
        );
      }

      if (query.confirmed !== undefined) {
        if (query.confirmed) {
          whereConditions.push(Prisma.sql`cbd.confirmed_at IS NOT NULL`);
        } else {
          whereConditions.push(Prisma.sql`cbd.confirmed_at IS NULL`);
        }
      }

      if (query.exported !== undefined) {
        if (query.exported) {
          whereConditions.push(Prisma.sql`cbd.last_exported_at IS NOT NULL`);
        } else {
          whereConditions.push(Prisma.sql`cbd.last_exported_at IS NULL`);
        }
      }

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
            cbd.bid_qty AS "bidQty",
            cbd.bid_start AS "bidStart",
            cbd.bid_end AS "bidEnd",
            cbd.erp_status AS "erpStatus",
            cbd.last_year_bid_qty AS "lastYearBidQty",
            cbd.last_year_actual AS "lastYearActual",
            cbd.ly_august AS "lyAugust",
            cbd.ly_september AS "lySeptember",
            cbd.ly_october AS "lyOctober",
            cbd.is_lost AS "isLost",
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
        erpStatus: row.erpStatus,
        bidQuantity: row.bidQty ? Number(row.bidQty) : null,
        lastYearBidQty: row.lastYearBidQty ? Number(row.lastYearBidQty) : null,
        lastYearActual: row.lastYearActual ? Number(row.lastYearActual) : null,
        lyAugust: row.lyAugust ? Number(row.lyAugust) : null,
        lySeptember: row.lySeptember ? Number(row.lySeptember) : null,
        lyOctober: row.lyOctober ? Number(row.lyOctober) : null,
        isLost: row.isLost ?? false,
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
   * Calculate school year boundaries based on selected school year
   *
   * School Year Definition: July 1 - July 31
   * - Previous: (year-2)-07-01 to (year-1)-07-31
   * - Current: (year-1)-07-01 to year-07-31
   * - Next: year-07-01 to (year+1)-07-31
   *
   * @param schoolYear - The school year filter option
   * @returns Start and end dates for the selected school year
   */
  private getSchoolYearBoundaries(schoolYear: SchoolYear = "next"): {
    startDate: Date;
    endDate: Date;
  } {
    const currentYear = new Date().getFullYear();

    switch (schoolYear) {
      case "previous":
        return {
          startDate: new Date(currentYear - 2, 6, 1), // (year-2)-07-01
          endDate: new Date(currentYear - 1, 6, 31), // (year-1)-07-31
        };
      case "current":
        return {
          startDate: new Date(currentYear - 1, 6, 1), // (year-1)-07-01
          endDate: new Date(currentYear, 6, 31), // year-07-31
        };
      case "next":
      default:
        return {
          startDate: new Date(currentYear, 6, 1), // year-07-01
          endDate: new Date(currentYear + 1, 6, 31), // (year+1)-07-31
        };
    }
  }

  /**
   * Get school year string from boundaries (e.g., "2025-2026")
   */
  private getSchoolYearString(schoolYear: SchoolYear = "next"): string {
    const { startDate } = this.getSchoolYearBoundaries(schoolYear);
    return `${startDate.getFullYear()}-${startDate.getFullYear() + 1}`;
  }

  /**
   * Update user-editable fields on a customer bid record
   */
  async updateBid(
    key: CustomerBidKeyDto,
    data: UpdateCustomerBidDto,
    userEmail: string
  ): Promise<CustomerBidDto> {
    logger.debug(
      { event: "customer-bid.update", key, data },
      "Updating customer bid"
    );

    try {
      const compositeKey = {
        sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
          sourceDb: key.sourceDb,
          siteCode: key.siteCode,
          customerBillTo: key.customerBillTo,
          itemNo: key.itemNo,
          schoolYear: key.schoolYear,
        },
      };

      // Check if bid is confirmed — enforce restrictions
      const existing = await this.prisma.customerBidData.findUnique({
        where: compositeKey,
      });

      if (existing?.confirmedAt) {
        // Reject yearAround changes on confirmed bids
        if (data.yearAround !== undefined) {
          throw new CustomerBidQueryError(
            "Cannot update Year Around on a confirmed bid"
          );
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
    const estimateFields = [
      "estimateJan",
      "estimateFeb",
      "estimateMar",
      "estimateApr",
      "estimateMay",
      "estimateJun",
      "estimateJul",
      "estimateAug",
      "estimateSep",
      "estimateOct",
      "estimateNov",
      "estimateDec",
    ] as const;
    for (const field of estimateFields) {
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

    const estimateFields = [
      "estimateJan",
      "estimateFeb",
      "estimateMar",
      "estimateApr",
      "estimateMay",
      "estimateJun",
      "estimateJul",
      "estimateAug",
      "estimateSep",
      "estimateOct",
      "estimateNov",
      "estimateDec",
    ] as const;
    for (const f of estimateFields) {
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
        const compositeKey = {
          sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
            sourceDb: key.sourceDb,
            siteCode: key.siteCode,
            customerBillTo: key.customerBillTo,
            itemNo: key.itemNo,
            schoolYear: key.schoolYear,
          },
        };
        const existing = await this.prisma.customerBidData.findUnique({
          where: compositeKey,
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
    isLost: boolean;
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
      erpStatus: null,
      bidQuantity: null,
      lastYearBidQty: record.lastYearBidQty
        ? Number(record.lastYearBidQty)
        : null,
      lastYearActual: record.lastYearActual
        ? Number(record.lastYearActual)
        : null,
      lyAugust: record.lyAugust ? Number(record.lyAugust) : null,
      lySeptember: record.lySeptember ? Number(record.lySeptember) : null,
      lyOctober: record.lyOctober ? Number(record.lyOctober) : null,
      isLost: record.isLost,
      lastUpdatedAt: record.lastUpdatedAt?.toISOString() ?? null,
      lastUpdatedBy: record.lastUpdatedBy ?? null,
      confirmedAt: record.confirmedAt?.toISOString() ?? null,
      confirmedBy: record.confirmedBy ?? null,
      lastExportedAt: record.lastExportedAt?.toISOString() ?? null,
      lastExportedBy: record.lastExportedBy ?? null,
      yearAround: record.yearAround,
      // Monthly estimates
      estimateJan: record.estimateJan ? Number(record.estimateJan) : null,
      estimateFeb: record.estimateFeb ? Number(record.estimateFeb) : null,
      estimateMar: record.estimateMar ? Number(record.estimateMar) : null,
      estimateApr: record.estimateApr ? Number(record.estimateApr) : null,
      estimateMay: record.estimateMay ? Number(record.estimateMay) : null,
      estimateJun: record.estimateJun ? Number(record.estimateJun) : null,
      estimateJul: record.estimateJul ? Number(record.estimateJul) : null,
      estimateAug: record.estimateAug ? Number(record.estimateAug) : null,
      estimateSep: record.estimateSep ? Number(record.estimateSep) : null,
      estimateOct: record.estimateOct ? Number(record.estimateOct) : null,
      estimateNov: record.estimateNov ? Number(record.estimateNov) : null,
      estimateDec: record.estimateDec ? Number(record.estimateDec) : null,
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
        where: {
          sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
            sourceDb: key.sourceDb,
            siteCode: key.siteCode,
            customerBillTo: key.customerBillTo,
            itemNo: key.itemNo,
            schoolYear: key.schoolYear,
          },
        },
      });

      if (!existing) {
        throw new CustomerBidQueryError(
          "Cannot confirm: no estimate data exists for this bid"
        );
      }

      const estimates = [
        existing.estimateJan,
        existing.estimateFeb,
        existing.estimateMar,
        existing.estimateApr,
        existing.estimateMay,
        existing.estimateJun,
        existing.estimateJul,
        existing.estimateAug,
        existing.estimateSep,
        existing.estimateOct,
        existing.estimateNov,
        existing.estimateDec,
      ];
      const hasValidMonth = estimates.some(
        (est) => est != null && Number(est) > 0
      );

      if (!hasValidMonth) {
        throw new CustomerBidQueryError(
          "Cannot confirm: at least one month must have an estimate greater than 0"
        );
      }

      const record = await this.prisma.customerBidData.update({
        where: {
          sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
            sourceDb: key.sourceDb,
            siteCode: key.siteCode,
            customerBillTo: key.customerBillTo,
            itemNo: key.itemNo,
            schoolYear: key.schoolYear,
          },
        },
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
        where: {
          sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
            sourceDb: key.sourceDb,
            siteCode: key.siteCode,
            customerBillTo: key.customerBillTo,
            itemNo: key.itemNo,
            schoolYear: key.schoolYear,
          },
        },
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
    const schoolYearString = this.getSchoolYearString(schoolYear);

    logger.info(
      { event: "customer-bid.sync.start", syncId, schoolYear, triggeredBy },
      "Starting customer bid sync"
    );

    // Check if there's already a sync in progress (within last 2 hours)
    const staleThresholdMs = 2 * 60 * 60 * 1000;
    const inProgress = await this.prisma.customerBidSyncLog.findFirst({
      where: {
        status: "IN_PROGRESS",
        startedAt: { gte: new Date(Date.now() - staleThresholdMs) },
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
      const { startDate, endDate } = this.getSchoolYearBoundaries(schoolYear);
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

      // Query current year bids to sync (with bid qty, dates)
      const currentYearBids = await this.prisma.$queryRaw<
        Array<{
          source_db: string;
          site_code: string;
          customer_bill_to: string;
          item_no: string;
          bid_qty: Prisma.Decimal;
          bid_start: Date;
          bid_end: Date;
        }>
      >(Prisma.sql`
        SELECT
            sp.source_db,
            c.location_code AS site_code,
            sp.sales_code AS customer_bill_to,
            sp.item_no_ AS item_no,
            SUM(sp.customer_bid_qty_) AS bid_qty,
            MIN(sp.starting_date) AS bid_start,
            MAX(sp.ending_date) AS bid_end
        FROM dw2_nav.sales_price sp
        INNER JOIN dw2_nav.customer c
            ON sp.sales_code = c.no_
            AND sp.source_db = c.source_db
        WHERE sp.starting_date >= ${startDateStr}::date
          AND sp.ending_date <= ${endDateStr}::date
          AND c.location_code IS NOT NULL
          AND c.location_code != ''
        GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_
      `);

      logger.debug(
        {
          event: "customer-bid.sync.bids-found",
          syncId,
          count: currentYearBids.length,
        },
        "Found current year bids to sync"
      );

      // Query last year bids for comparison
      const lastYearBidsMap = new Map<string, Prisma.Decimal>();
      const lastYearBids = await this.prisma.$queryRaw<
        Array<{
          source_db: string;
          site_code: string;
          customer_bill_to: string;
          item_no: string;
          bid_qty: Prisma.Decimal;
        }>
      >(Prisma.sql`
        SELECT
            sp.source_db,
            c.location_code AS site_code,
            sp.sales_code AS customer_bill_to,
            sp.item_no_ AS item_no,
            SUM(sp.customer_bid_qty_) AS bid_qty
        FROM dw2_nav.sales_price sp
        INNER JOIN dw2_nav.customer c
            ON sp.sales_code = c.no_
            AND sp.source_db = c.source_db
        WHERE sp.starting_date >= ${lastYearStartStr}::date
          AND sp.ending_date <= ${lastYearEndStr}::date
          AND c.location_code IS NOT NULL
          AND c.location_code != ''
        GROUP BY sp.source_db, c.location_code, sp.sales_code, sp.item_no_
      `);

      for (const row of lastYearBids) {
        const key = `${row.source_db}|${row.site_code}|${row.customer_bill_to}|${row.item_no}`;
        lastYearBidsMap.set(key, row.bid_qty);
      }

      // Query last year actual sales from item ledger entries joined with invoice headers
      // entry_type = 1 is Sale, join with sales_invoice_header to get bill_to_customer_no_
      // quantities are negative so we use ABS()
      const lastYearSalesMap = new Map<
        string,
        {
          totalQty: Prisma.Decimal;
          augQty: Prisma.Decimal;
          sepQty: Prisma.Decimal;
          octQty: Prisma.Decimal;
        }
      >();
      const lastYearSales = await this.prisma.$queryRaw<
        Array<{
          source_db: string;
          site_code: string;
          customer_bill_to: string;
          item_no: string;
          total_quantity: Prisma.Decimal;
          august_qty: Prisma.Decimal;
          september_qty: Prisma.Decimal;
          october_qty: Prisma.Decimal;
        }>
      >(Prisma.sql`
        SELECT
            ile.source_db,
            c.location_code AS site_code,
            sih.bill_to_customer_no_ AS customer_bill_to,
            ile.item_no_ AS item_no,
            ABS(SUM(ile.quantity)) AS total_quantity,
            ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 8 THEN ile.quantity ELSE 0 END)) AS august_qty,
            ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 9 THEN ile.quantity ELSE 0 END)) AS september_qty,
            ABS(SUM(CASE WHEN EXTRACT(MONTH FROM sih.posting_date) = 10 THEN ile.quantity ELSE 0 END)) AS october_qty
        FROM dw2_nav.item_ledger_entry ile
        INNER JOIN dw2_nav.sales_invoice_header sih
            ON ile.document_no_ = sih.no_
            AND ile.source_db = sih.source_db
        INNER JOIN dw2_nav.customer c
            ON sih.bill_to_customer_no_ = c.no_
            AND sih.source_db = c.source_db
        WHERE ile.entry_type = 1
          AND sih.posting_date >= ${lastYearStartStr}::date
          AND sih.posting_date <= ${lastYearEndStr}::date
          AND c.location_code IS NOT NULL
          AND c.location_code != ''
        GROUP BY ile.source_db, c.location_code, sih.bill_to_customer_no_, ile.item_no_
      `);

      logger.debug(
        {
          event: "customer-bid.sync.sales-found",
          syncId,
          count: lastYearSales.length,
        },
        "Found last year sales data"
      );

      for (const row of lastYearSales) {
        const key = `${row.source_db}|${row.site_code}|${row.customer_bill_to}|${row.item_no}`;
        lastYearSalesMap.set(key, {
          totalQty: row.total_quantity,
          augQty: row.august_qty,
          sepQty: row.september_qty,
          octQty: row.october_qty,
        });
      }

      // Query ERP status for all items (latest by last_date_modified)
      const erpStatusMap = new Map<string, string>();
      const erpStatuses = await this.prisma.$queryRaw<
        Array<{
          source_db: string;
          item_no: string;
          status: string;
        }>
      >(Prisma.sql`
        SELECT DISTINCT ON (item_no_, source_db)
            source_db,
            item_no_ AS item_no,
            status
        FROM dw2_nav.stockkeeping_unit
        ORDER BY item_no_, source_db, last_date_modified DESC
      `);

      for (const row of erpStatuses) {
        const key = `${row.source_db}|${row.item_no}`;
        erpStatusMap.set(key, row.status);
      }

      logger.debug(
        {
          event: "customer-bid.sync.erp-status-found",
          syncId,
          count: erpStatuses.length,
        },
        "Found ERP status data"
      );

      // Create set of current year keys for isLost calculation
      const currentYearKeys = new Set(
        currentYearBids.map(
          (b) =>
            `${b.source_db}|${b.site_code}|${b.customer_bill_to}|${b.item_no}`
        )
      );

      let recordsInserted = 0;
      let recordsUpdated = 0;

      // Upsert records in batches using raw SQL to track inserts vs updates
      const batchSize = 100;
      const now = new Date();

      for (let i = 0; i < currentYearBids.length; i += batchSize) {
        const batch = currentYearBids.slice(i, i + batchSize);

        // Build batch data with all computed values
        const batchData = batch.map((bid) => {
          const key = `${bid.source_db}|${bid.site_code}|${bid.customer_bill_to}|${bid.item_no}`;
          const erpKey = `${bid.source_db}|${bid.item_no}`;
          const lastYearBidQty = lastYearBidsMap.get(key) ?? null;
          const salesData = lastYearSalesMap.get(key);
          const erpStatus = erpStatusMap.get(erpKey) ?? null;
          const wasInLastYear = lastYearBidsMap.has(key);
          const isInCurrentYear = currentYearKeys.has(key);
          const isLost = wasInLastYear && !isInCurrentYear;

          return {
            sourceDb: bid.source_db,
            siteCode: bid.site_code,
            customerBillTo: bid.customer_bill_to,
            itemNo: bid.item_no,
            schoolYear: schoolYearString,
            bidQty: bid.bid_qty,
            bidStart: bid.bid_start,
            bidEnd: bid.bid_end,
            erpStatus,
            lastYearBidQty,
            isLost,
            lastYearActual: salesData?.totalQty ?? null,
            lyAugust: salesData?.augQty ?? null,
            lySeptember: salesData?.sepQty ?? null,
            lyOctober: salesData?.octQty ?? null,
          };
        });

        // Use raw SQL with ON CONFLICT to track inserts vs updates via xmax
        const results = await this.prisma.$queryRaw<Array<{ xmax: string }>>(
          Prisma.sql`
            INSERT INTO ait.customer_bid_data (
              source_db, site_code, customer_bill_to, item_no, school_year,
              bid_qty, bid_start, bid_end, erp_status,
              last_year_bid_qty, is_lost, last_year_actual,
              ly_august, ly_september, ly_october, synced_at, updated_at
            )
            SELECT * FROM UNNEST(
              ${batchData.map((d) => d.sourceDb)}::text[],
              ${batchData.map((d) => d.siteCode)}::text[],
              ${batchData.map((d) => d.customerBillTo)}::text[],
              ${batchData.map((d) => d.itemNo)}::text[],
              ${batchData.map((d) => d.schoolYear)}::text[],
              ${batchData.map((d) => (d.bidQty ? Number(d.bidQty) : null))}::decimal[],
              ${batchData.map((d) => d.bidStart)}::timestamp[],
              ${batchData.map((d) => d.bidEnd)}::timestamp[],
              ${batchData.map((d) => d.erpStatus)}::text[],
              ${batchData.map((d) => (d.lastYearBidQty ? Number(d.lastYearBidQty) : null))}::decimal[],
              ${batchData.map((d) => d.isLost)}::boolean[],
              ${batchData.map((d) => (d.lastYearActual ? Number(d.lastYearActual) : null))}::decimal[],
              ${batchData.map((d) => (d.lyAugust ? Number(d.lyAugust) : null))}::decimal[],
              ${batchData.map((d) => (d.lySeptember ? Number(d.lySeptember) : null))}::decimal[],
              ${batchData.map((d) => (d.lyOctober ? Number(d.lyOctober) : null))}::decimal[],
              ${batchData.map(() => now)}::timestamp[],
              ${batchData.map(() => now)}::timestamp[]
            )
            ON CONFLICT (source_db, site_code, customer_bill_to, item_no, school_year)
            DO UPDATE SET
              bid_qty = EXCLUDED.bid_qty,
              bid_start = EXCLUDED.bid_start,
              bid_end = EXCLUDED.bid_end,
              erp_status = EXCLUDED.erp_status,
              last_year_bid_qty = EXCLUDED.last_year_bid_qty,
              is_lost = EXCLUDED.is_lost,
              last_year_actual = EXCLUDED.last_year_actual,
              ly_august = EXCLUDED.ly_august,
              ly_september = EXCLUDED.ly_september,
              ly_october = EXCLUDED.ly_october,
              synced_at = EXCLUDED.synced_at,
              updated_at = EXCLUDED.updated_at
            RETURNING xmax::text
          `
        );

        // Count inserts vs updates: xmax = 0 means INSERT, xmax > 0 means UPDATE
        for (const row of results) {
          if (row.xmax === "0") {
            recordsInserted++;
          } else {
            recordsUpdated++;
          }
        }
      }

      // Process LOST bids: bids that existed last year but NOT in current year
      const lostBids = lastYearBids.filter((lyBid) => {
        const key = `${lyBid.source_db}|${lyBid.site_code}|${lyBid.customer_bill_to}|${lyBid.item_no}`;
        return !currentYearKeys.has(key);
      });

      logger.debug(
        {
          event: "customer-bid.sync.lost-bids",
          syncId,
          count: lostBids.length,
        },
        "Processing LOST bids"
      );

      for (let i = 0; i < lostBids.length; i += batchSize) {
        const batch = lostBids.slice(i, i + batchSize);
        const syncedAt = new Date();

        // Build batch data with computed values
        const batchData = batch.map((bid) => {
          const key = `${bid.source_db}|${bid.site_code}|${bid.customer_bill_to}|${bid.item_no}`;
          const erpKey = `${bid.source_db}|${bid.item_no}`;
          const salesData = lastYearSalesMap.get(key);
          const erpStatus = erpStatusMap.get(erpKey) ?? null;

          return {
            sourceDb: bid.source_db,
            siteCode: bid.site_code,
            customerBillTo: bid.customer_bill_to,
            itemNo: bid.item_no,
            schoolYear: schoolYearString,
            erpStatus,
            lastYearBidQty: bid.bid_qty,
            isLost: true,
            lastYearActual: salesData?.totalQty ?? null,
            lyAugust: salesData?.augQty ?? null,
            lySeptember: salesData?.sepQty ?? null,
            lyOctober: salesData?.octQty ?? null,
            syncedAt,
          };
        });

        // Use raw SQL with UNNEST to batch insert and get xmax for insert/update tracking
        const results = await this.prisma.$queryRaw<Array<{ xmax: string }>>(
          Prisma.sql`
            INSERT INTO ait.customer_bid_data (
              source_db, site_code, customer_bill_to, item_no, school_year,
              erp_status, last_year_bid_qty, is_lost,
              last_year_actual, ly_august, ly_september, ly_october, synced_at, updated_at
            )
            SELECT * FROM UNNEST(
              ${batchData.map((d) => d.sourceDb)}::text[],
              ${batchData.map((d) => d.siteCode)}::text[],
              ${batchData.map((d) => d.customerBillTo)}::text[],
              ${batchData.map((d) => d.itemNo)}::text[],
              ${batchData.map((d) => d.schoolYear)}::text[],
              ${batchData.map((d) => d.erpStatus)}::text[],
              ${batchData.map((d) => (d.lastYearBidQty ? Number(d.lastYearBidQty) : null))}::decimal[],
              ${batchData.map((d) => d.isLost)}::boolean[],
              ${batchData.map((d) => (d.lastYearActual ? Number(d.lastYearActual) : null))}::decimal[],
              ${batchData.map((d) => (d.lyAugust ? Number(d.lyAugust) : null))}::decimal[],
              ${batchData.map((d) => (d.lySeptember ? Number(d.lySeptember) : null))}::decimal[],
              ${batchData.map((d) => (d.lyOctober ? Number(d.lyOctober) : null))}::decimal[],
              ${batchData.map(() => syncedAt)}::timestamp[],
              ${batchData.map(() => syncedAt)}::timestamp[]
            )
            ON CONFLICT (source_db, site_code, customer_bill_to, item_no, school_year)
            DO UPDATE SET
              erp_status = EXCLUDED.erp_status,
              last_year_bid_qty = EXCLUDED.last_year_bid_qty,
              is_lost = EXCLUDED.is_lost,
              last_year_actual = EXCLUDED.last_year_actual,
              ly_august = EXCLUDED.ly_august,
              ly_september = EXCLUDED.ly_september,
              ly_october = EXCLUDED.ly_october,
              synced_at = EXCLUDED.synced_at,
              updated_at = EXCLUDED.updated_at
            RETURNING xmax::text
          `
        );

        // Count inserts vs updates: xmax = 0 means INSERT, xmax > 0 means UPDATE
        for (const row of results) {
          if (row.xmax === "0") {
            recordsInserted++;
          } else {
            recordsUpdated++;
          }
        }
      }

      const durationMs = Date.now() - startTime;

      const totalRecords = currentYearBids.length + lostBids.length;

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
          wonBids: currentYearBids.length,
          lostBids: lostBids.length,
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
