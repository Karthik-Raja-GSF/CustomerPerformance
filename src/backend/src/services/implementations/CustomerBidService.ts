import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { ICustomerBidService } from "@/services/ICustomerBidService";
import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidDto,
  CustomerBidKeyDto,
  UpdateCustomerBidDto,
  BulkUpdateCustomerBidDto,
  BulkUpdateResultDto,
  SyncResultDto,
  SyncLogDto,
  SchoolYear,
} from "@/contracts/dtos/customer-bid.dto";
import {
  CustomerBidDatabaseError,
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
  confirmed: boolean | null;
  yearAround: boolean | null;
  augustDemand: Prisma.Decimal | null;
  septemberDemand: Prisma.Decimal | null;
  octoberDemand: Prisma.Decimal | null;
  // Menu months
  menuJan: boolean | null;
  menuFeb: boolean | null;
  menuMar: boolean | null;
  menuApr: boolean | null;
  menuMay: boolean | null;
  menuJun: boolean | null;
  menuJul: boolean | null;
  menuAug: boolean | null;
  menuSep: boolean | null;
  menuOct: boolean | null;
  menuNov: boolean | null;
  menuDec: boolean | null;
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
      // Calculate school year boundaries
      const { startDate, endDate } = this.getSchoolYearBoundaries(schoolYear);

      // Format dates for SQL (YYYY-MM-DD)
      const startDateStr = startDate.toISOString().slice(0, 10);
      const endDateStr = endDate.toISOString().slice(0, 10);

      logger.debug(
        {
          event: "customer-bid.school-year",
          schoolYear,
          startDate: startDateStr,
          endDate: endDateStr,
        },
        "Calculated school year boundaries"
      );

      // Build WHERE clause conditions for filters
      const whereConditions: Prisma.Sql[] = [];

      if (query.siteCode) {
        whereConditions.push(Prisma.sql`c.location_code = ${query.siteCode}`);
      }

      if (query.customerBillTo) {
        whereConditions.push(
          Prisma.sql`c.no_ ILIKE ${"%" + query.customerBillTo + "%"}`
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
        whereConditions.push(Prisma.sql`sp.item_no_ = ${query.itemCode}`);
      }

      if (query.erpStatus) {
        whereConditions.push(
          Prisma.sql`sku_latest.status ILIKE ${"%" + query.erpStatus + "%"}`
        );
      }

      if (query.sourceDb) {
        whereConditions.push(Prisma.sql`sp.source_db = ${query.sourceDb}`);
      }

      const additionalWhere =
        whereConditions.length > 0
          ? Prisma.sql`AND ${Prisma.join(whereConditions, " AND ")}`
          : Prisma.empty;

      // Calculate school year string for JOIN (e.g., "2025-2026")
      const schoolYearString = `${startDate.getFullYear()}-${startDate.getFullYear() + 1}`;

      // Execute the new simplified query with materialized CTE
      const baseQuery = Prisma.sql`
        WITH filtered_sales AS MATERIALIZED (
            SELECT DISTINCT
                item_no_,
                source_db,
                sales_code,
                starting_date,
                ending_date
            FROM dw2_nav.sales_price
            WHERE starting_date >= ${startDateStr}::date
                AND ending_date <= ${endDateStr}::date
        )
        SELECT
            sp.source_db AS "sourceDb",
            c.location_code AS "siteCode",
            c."name" AS "customerName",
            c.no_ AS "customerBillTo",
            c.contact AS "contactName",
            c.e_mail AS "contactEmail",
            c.phone_no_ AS "contactPhone",
            c.salesperson_code AS "salesRep",
            sp.item_no_ AS "itemNo",
            i.description AS "itemDescription",
            i.description_2 AS "brandName",
            cbd.bid_qty AS "bidQty",
            MIN(sp.starting_date) AS "bidStart",
            MAX(sp.ending_date) AS "bidEnd",
            sku_latest.status AS "erpStatus",
            -- From customer_bid_data table (pre-calculated by sync)
            cbd.last_year_bid_qty AS "lastYearBidQty",
            cbd.last_year_actual AS "lastYearActual",
            cbd.ly_august AS "lyAugust",
            cbd.ly_september AS "lySeptember",
            cbd.ly_october AS "lyOctober",
            COALESCE(cbd.is_lost, false) AS "isLost",
            -- User-editable fields
            COALESCE(cbd.confirmed, false) AS "confirmed",
            COALESCE(cbd.year_around, false) AS "yearAround",
            cbd.august_demand AS "augustDemand",
            cbd.september_demand AS "septemberDemand",
            cbd.october_demand AS "octoberDemand",
            -- Menu months
            cbd.jan AS "menuJan",
            cbd.feb AS "menuFeb",
            cbd.mar AS "menuMar",
            cbd.apr AS "menuApr",
            cbd.may AS "menuMay",
            cbd.jun AS "menuJun",
            cbd.jul AS "menuJul",
            cbd.aug AS "menuAug",
            cbd.sep AS "menuSep",
            cbd.oct AS "menuOct",
            cbd.nov AS "menuNov",
            cbd.dec AS "menuDec"
        FROM filtered_sales sp
        INNER JOIN dw2_nav.customer c
            ON sp.sales_code = c.no_
            AND sp.source_db = c.source_db
        INNER JOIN dw2_nav.item i
            ON sp.item_no_ = i.no_
            AND sp.source_db = i.source_db
        INNER JOIN (
            SELECT DISTINCT ON (item_no_, source_db)
                item_no_,
                source_db,
                status
            FROM dw2_nav.stockkeeping_unit
            ORDER BY item_no_, source_db, last_date_modified DESC
        ) sku_latest
            ON sp.item_no_ = sku_latest.item_no_
            AND sp.source_db = sku_latest.source_db
        LEFT JOIN ait.customer_bid_data cbd
            ON sp.source_db = cbd.source_db
            AND c.location_code = cbd.site_code
            AND c.no_ = cbd.customer_bill_to
            AND sp.item_no_ = cbd.item_no
            AND cbd.school_year = ${schoolYearString}
        WHERE 1=1 ${additionalWhere}
        GROUP BY
            sp.source_db,
            c.location_code,
            sp.item_no_,
            i.description,
            i.description_2,
            c.no_,
            c."name",
            c.contact,
            c.e_mail,
            c.phone_no_,
            c.salesperson_code,
            sku_latest.status,
            cbd.bid_qty,
            cbd.last_year_bid_qty,
            cbd.last_year_actual,
            cbd.ly_august,
            cbd.ly_september,
            cbd.ly_october,
            cbd.is_lost,
            cbd.confirmed,
            cbd.year_around,
            cbd.august_demand,
            cbd.september_demand,
            cbd.october_demand,
            cbd.jan,
            cbd.feb,
            cbd.mar,
            cbd.apr,
            cbd.may,
            cbd.jun,
            cbd.jul,
            cbd.aug,
            cbd.sep,
            cbd.oct,
            cbd.nov,
            cbd.dec
        ORDER BY c.location_code, sp.item_no_, c.no_
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
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        salesRep: row.salesRep,
        bidStartDate: row.bidStart.toISOString(),
        bidEndDate: row.bidEnd?.toISOString() ?? null,
        itemCode: row.itemNo,
        itemDescription: row.itemDescription,
        brandName: row.brandName,
        erpStatus: row.erpStatus,
        bidQuantity: row.bidQty ? Number(row.bidQty) : null,
        // Pre-calculated fields (from sync)
        lastYearBidQty: row.lastYearBidQty ? Number(row.lastYearBidQty) : null,
        lastYearActual: row.lastYearActual ? Number(row.lastYearActual) : null,
        lyAugust: row.lyAugust ? Number(row.lyAugust) : null,
        lySeptember: row.lySeptember ? Number(row.lySeptember) : null,
        lyOctober: row.lyOctober ? Number(row.lyOctober) : null,
        isLost: row.isLost ?? false,
        // User-editable fields
        confirmed: row.confirmed ?? false,
        yearAround: row.yearAround ?? false,
        augustDemand: row.augustDemand ? Number(row.augustDemand) : null,
        septemberDemand: row.septemberDemand
          ? Number(row.septemberDemand)
          : null,
        octoberDemand: row.octoberDemand ? Number(row.octoberDemand) : null,
        // Menu months
        menuJan: row.menuJan,
        menuFeb: row.menuFeb,
        menuMar: row.menuMar,
        menuApr: row.menuApr,
        menuMay: row.menuMay,
        menuJun: row.menuJun,
        menuJul: row.menuJul,
        menuAug: row.menuAug,
        menuSep: row.menuSep,
        menuOct: row.menuOct,
        menuNov: row.menuNov,
        menuDec: row.menuDec,
      }));

      logger.info(
        {
          event: "customer-bid.query.success",
          page,
          limit,
          returnedCount: data.length,
          hasMore,
          schoolYear,
          dateRange: { startDate: startDateStr, endDate: endDateStr },
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
    userId: string
  ): Promise<CustomerBidDto> {
    logger.debug(
      { event: "customer-bid.update", key, data, userId },
      "Updating customer bid"
    );

    try {
      // Upsert the record - create if not exists, update if exists
      const record = await this.prisma.customerBidData.upsert({
        where: {
          sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
            sourceDb: key.sourceDb,
            siteCode: key.siteCode,
            customerBillTo: key.customerBillTo,
            itemNo: key.itemNo,
            schoolYear: key.schoolYear,
          },
        },
        create: {
          sourceDb: key.sourceDb,
          siteCode: key.siteCode,
          customerBillTo: key.customerBillTo,
          itemNo: key.itemNo,
          schoolYear: key.schoolYear,
          confirmed: data.confirmed ?? false,
          yearAround: data.yearAround ?? false,
          augustDemand: data.augustDemand,
          septemberDemand: data.septemberDemand,
          octoberDemand: data.octoberDemand,
          confirmedBy: data.confirmed ? userId : null,
          confirmedAt: data.confirmed ? new Date() : null,
          // Menu months
          menuJan: data.menuJan,
          menuFeb: data.menuFeb,
          menuMar: data.menuMar,
          menuApr: data.menuApr,
          menuMay: data.menuMay,
          menuJun: data.menuJun,
          menuJul: data.menuJul,
          menuAug: data.menuAug,
          menuSep: data.menuSep,
          menuOct: data.menuOct,
          menuNov: data.menuNov,
          menuDec: data.menuDec,
        },
        update: {
          confirmed: data.confirmed,
          yearAround: data.yearAround,
          augustDemand: data.augustDemand,
          septemberDemand: data.septemberDemand,
          octoberDemand: data.octoberDemand,
          confirmedBy: data.confirmed ? userId : undefined,
          confirmedAt: data.confirmed ? new Date() : undefined,
          // Menu months
          menuJan: data.menuJan,
          menuFeb: data.menuFeb,
          menuMar: data.menuMar,
          menuApr: data.menuApr,
          menuMay: data.menuMay,
          menuJun: data.menuJun,
          menuJul: data.menuJul,
          menuAug: data.menuAug,
          menuSep: data.menuSep,
          menuOct: data.menuOct,
          menuNov: data.menuNov,
          menuDec: data.menuDec,
        },
      });

      logger.info(
        { event: "customer-bid.update.success", key },
        "Customer bid updated successfully"
      );

      // Return a minimal DTO (full data requires querying with JOINs)
      return {
        sourceDb: record.sourceDb,
        siteCode: record.siteCode,
        customerName: null,
        customerBillTo: record.customerBillTo,
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
        confirmed: record.confirmed,
        yearAround: record.yearAround,
        augustDemand: record.augustDemand ? Number(record.augustDemand) : null,
        septemberDemand: record.septemberDemand
          ? Number(record.septemberDemand)
          : null,
        octoberDemand: record.octoberDemand
          ? Number(record.octoberDemand)
          : null,
        // Menu months
        menuJan: record.menuJan,
        menuFeb: record.menuFeb,
        menuMar: record.menuMar,
        menuApr: record.menuApr,
        menuMay: record.menuMay,
        menuJun: record.menuJun,
        menuJul: record.menuJul,
        menuAug: record.menuAug,
        menuSep: record.menuSep,
        menuOct: record.menuOct,
        menuNov: record.menuNov,
        menuDec: record.menuDec,
      };
    } catch (error) {
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
   * Bulk update user-editable fields on multiple customer bid records
   */
  async bulkUpdateBids(
    data: BulkUpdateCustomerBidDto,
    userId: string
  ): Promise<BulkUpdateResultDto> {
    logger.debug(
      { event: "customer-bid.bulk-update", recordCount: data.records.length },
      "Bulk updating customer bids"
    );

    let updated = 0;
    let failed = 0;
    const errors: Array<{ key: string; message: string }> = [];

    for (const record of data.records) {
      try {
        await this.updateBid(
          {
            sourceDb: record.sourceDb,
            siteCode: record.siteCode,
            customerBillTo: record.customerBillTo,
            itemNo: record.itemNo,
            schoolYear: record.schoolYear,
          },
          {
            confirmed: record.confirmed,
            yearAround: record.yearAround,
            augustDemand: record.augustDemand,
            septemberDemand: record.septemberDemand,
            octoberDemand: record.octoberDemand,
            menuJan: record.menuJan,
            menuFeb: record.menuFeb,
            menuMar: record.menuMar,
            menuApr: record.menuApr,
            menuMay: record.menuMay,
            menuJun: record.menuJun,
            menuJul: record.menuJul,
            menuAug: record.menuAug,
            menuSep: record.menuSep,
            menuOct: record.menuOct,
            menuNov: record.menuNov,
            menuDec: record.menuDec,
          },
          userId
        );
        updated++;
      } catch (error) {
        failed++;
        const keyStr = `${record.sourceDb}/${record.siteCode}/${record.customerBillTo}/${record.itemNo}/${record.schoolYear}`;
        errors.push({
          key: keyStr,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    logger.info(
      { event: "customer-bid.bulk-update.complete", updated, failed },
      "Bulk update completed"
    );

    return {
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
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

      // Query current year bids to sync (with bid qty)
      const currentYearBids = await this.prisma.$queryRaw<
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
        WHERE sp.starting_date >= ${startDateStr}::date
          AND sp.ending_date <= ${endDateStr}::date
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

      // Create set of current year keys for isLost calculation
      const currentYearKeys = new Set(
        currentYearBids.map(
          (b) =>
            `${b.source_db}|${b.site_code}|${b.customer_bill_to}|${b.item_no}`
        )
      );

      let recordsInserted = 0;
      const recordsUpdated = 0;

      // Upsert records in batches
      const batchSize = 100;
      for (let i = 0; i < currentYearBids.length; i += batchSize) {
        const batch = currentYearBids.slice(i, i + batchSize);

        await this.prisma.$transaction(
          batch.map((bid) => {
            const key = `${bid.source_db}|${bid.site_code}|${bid.customer_bill_to}|${bid.item_no}`;
            const lastYearBidQty = lastYearBidsMap.get(key) ?? null;
            const salesData = lastYearSalesMap.get(key);
            const wasInLastYear = lastYearBidsMap.has(key);
            const isInCurrentYear = currentYearKeys.has(key);
            const isLost = wasInLastYear && !isInCurrentYear;

            return this.prisma.customerBidData.upsert({
              where: {
                sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
                  sourceDb: bid.source_db,
                  siteCode: bid.site_code,
                  customerBillTo: bid.customer_bill_to,
                  itemNo: bid.item_no,
                  schoolYear: schoolYearString,
                },
              },
              create: {
                sourceDb: bid.source_db,
                siteCode: bid.site_code,
                customerBillTo: bid.customer_bill_to,
                itemNo: bid.item_no,
                schoolYear: schoolYearString,
                bidQty: bid.bid_qty,
                lastYearBidQty,
                isLost,
                lastYearActual: salesData?.totalQty ?? null,
                lyAugust: salesData?.augQty ?? null,
                lySeptember: salesData?.sepQty ?? null,
                lyOctober: salesData?.octQty ?? null,
                syncedAt: new Date(),
              },
              update: {
                bidQty: bid.bid_qty,
                lastYearBidQty,
                isLost,
                lastYearActual: salesData?.totalQty ?? null,
                lyAugust: salesData?.augQty ?? null,
                lySeptember: salesData?.sepQty ?? null,
                lyOctober: salesData?.octQty ?? null,
                syncedAt: new Date(),
              },
            });
          })
        );
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

        await this.prisma.$transaction(
          batch.map((bid) => {
            const key = `${bid.source_db}|${bid.site_code}|${bid.customer_bill_to}|${bid.item_no}`;
            const salesData = lastYearSalesMap.get(key);

            return this.prisma.customerBidData.upsert({
              where: {
                sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
                  sourceDb: bid.source_db,
                  siteCode: bid.site_code,
                  customerBillTo: bid.customer_bill_to,
                  itemNo: bid.item_no,
                  schoolYear: schoolYearString,
                },
              },
              create: {
                sourceDb: bid.source_db,
                siteCode: bid.site_code,
                customerBillTo: bid.customer_bill_to,
                itemNo: bid.item_no,
                schoolYear: schoolYearString,
                lastYearBidQty: bid.bid_qty,
                isLost: true,
                lastYearActual: salesData?.totalQty ?? null,
                lyAugust: salesData?.augQty ?? null,
                lySeptember: salesData?.sepQty ?? null,
                lyOctober: salesData?.octQty ?? null,
                syncedAt: new Date(),
              },
              update: {
                lastYearBidQty: bid.bid_qty,
                isLost: true,
                lastYearActual: salesData?.totalQty ?? null,
                lyAugust: salesData?.augQty ?? null,
                lySeptember: salesData?.sepQty ?? null,
                lyOctober: salesData?.octQty ?? null,
                syncedAt: new Date(),
              },
            });
          })
        );
      }

      // Count inserted vs updated (approximate)
      recordsInserted = currentYearBids.length + lostBids.length;

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
