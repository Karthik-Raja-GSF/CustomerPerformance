import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { ICustomerBidService } from "@/services/ICustomerBidService";
import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidDto,
  SchoolYear,
} from "@/contracts/dtos/customer-bid.dto";
import { CustomerBidDatabaseError } from "@/utils/errors/customer-bid-errors";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("customer-bid");

/**
 * Raw database row result from the base customer bids query
 */
interface BaseBidRow {
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  itemNo: string;
  itemDescription: string | null;
  bidQty: Prisma.Decimal | null;
  bidStart: Date;
  bidEnd: Date | null;
  erpStatus: string | null;
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

      // Execute the new simplified query with materialized CTE
      const baseQuery = Prisma.sql`
        WITH filtered_sales AS MATERIALIZED (
            SELECT
                item_no_,
                source_db,
                sales_code,
                customer_bid_qty_,
                starting_date,
                ending_date
            FROM dw2_nav.sales_price
            WHERE starting_date >= ${startDateStr}::date
                AND ending_date <= ${endDateStr}::date
        )
        SELECT
            c.location_code AS "siteCode",
            c."name" AS "customerName",
            c.no_ AS "customerBillTo",
            c.contact AS "contactName",
            c.e_mail AS "contactEmail",
            c.phone_no_ AS "contactPhone",
            c.salesperson_code AS "salesRep",
            sp.item_no_ AS "itemNo",
            i.description AS "itemDescription",
            SUM(sp.customer_bid_qty_) AS "bidQty",
            MIN(sp.starting_date) AS "bidStart",
            MAX(sp.ending_date) AS "bidEnd",
            sku_latest.status AS "erpStatus"
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
        WHERE 1=1 ${additionalWhere}
        GROUP BY
            c.location_code,
            sp.item_no_,
            i.description,
            c.no_,
            c."name",
            c.contact,
            c.e_mail,
            c.phone_no_,
            c.salesperson_code,
            sku_latest.status
        ORDER BY c.location_code, sp.item_no_, c.no_
        LIMIT ${limit + 1} OFFSET ${offset}
      `;

      const rows = await this.prisma.$queryRaw<BaseBidRow[]>(baseQuery);

      // Calculate hasMore and trim to limit
      const hasMore = rows.length > limit;
      const trimmedRows = hasMore ? rows.slice(0, limit) : rows;

      // Map to DTO with "Coming Soon.." for removed fields
      const data: CustomerBidDto[] = trimmedRows.map((row) => ({
        siteCode: row.siteCode,
        customerName: row.customerName,
        customerBillTo: row.customerBillTo,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        salesRep: row.salesRep,
        wonLost: "Coming Soon..",
        bidStartDate: row.bidStart.toISOString(),
        bidEndDate: row.bidEnd?.toISOString() ?? null,
        itemCode: row.itemNo,
        itemDescription: row.itemDescription,
        erpStatus: row.erpStatus,
        bidQuantity: row.bidQty ? Number(row.bidQty) : null,
        lastYearBidQty: "Coming Soon..",
        lastYearActual: "Coming Soon..",
        lastYearAugust: "Coming Soon..",
        lastYearSeptember: "Coming Soon..",
        lastYearOctober: "Coming Soon..",
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
}
