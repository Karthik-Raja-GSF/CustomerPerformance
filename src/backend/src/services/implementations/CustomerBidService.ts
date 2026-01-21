import { injectable, inject } from "tsyringe";
import { PrismaClient, Prisma } from "@prisma/client";
import { ICustomerBidService } from "@/services/ICustomerBidService";
import {
  CustomerBidQueryDto,
  CustomerBidListResponseDto,
  CustomerBidDto,
} from "@/contracts/dtos/customer-bid.dto";
import { CustomerBidDatabaseError } from "@/utils/errors/customer-bid-errors";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("customer-bid");

/**
 * Raw database row result from the base customer bids query
 */
interface BaseBidRow {
  sourceDb: string;
  siteCode: string | null;
  customerName: string | null;
  customerBillTo: string | null;
  billToCustomerNo: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  salesRep: string | null;
  bidStartDate: Date;
  bidEndDate: Date | null;
  itemCode: string;
  itemDescription: string | null;
  erpStatus: string | null;
  bidQuantity: Prisma.Decimal | null;
}

/**
 * Result from current year items lookup
 */
interface CurrentYearItem {
  source_db: string;
  item_no_: string;
  bill_to_customer_no_: string;
}

/**
 * Result from previous year bids lookup
 */
interface PreviousYearBid {
  source_db: string;
  item_no_: string;
  bill_to_customer_no_: string;
  customer_bid_qty_: Prisma.Decimal | null;
}

/**
 * Result from sales invoice lookup (aggregated by location/item/customer)
 */
interface SalesLookupResult {
  source_db: string;
  location_code: string;
  item_no_: string;
  bill_to_customer_no_: string;
  total_amount: Prisma.Decimal | null;
}

/**
 * Customer Bid Service Implementation
 *
 * Retrieves customer bid data from NAV database tables with
 * calculated WON/LOST status based on school year periods.
 *
 * Performance optimization: Uses simple base query (~100ms) with
 * application-side won/lost calculation instead of complex CTEs (~195s).
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

    logger.debug(
      { event: "customer-bid.query", query, page, limit, offset },
      "Fetching customer bids"
    );

    try {
      // Calculate school year boundaries
      const {
        currentYearStart,
        currentYearEnd,
        previousYearStart,
        previousYearEnd,
        nextYearEnd,
      } = this.getSchoolYearBoundaries();

      logger.debug(
        {
          event: "customer-bid.school-years",
          currentYearStart,
          currentYearEnd,
          previousYearStart,
          previousYearEnd,
        },
        "Calculated school year boundaries"
      );

      // Build WHERE clause conditions (limit to previous, current, and next school year)
      const whereConditions: Prisma.Sql[] = [
        Prisma.sql`sp.starting_date >= ${previousYearStart}::date`,
        Prisma.sql`sp.starting_date < ${nextYearEnd}::date`,
      ];

      if (query.siteCode) {
        whereConditions.push(Prisma.sql`sku.location_code = ${query.siteCode}`);
      }

      if (query.customerBillTo) {
        whereConditions.push(
          Prisma.sql`c.bill_to_customer_no_ ILIKE ${"%" + query.customerBillTo + "%"}`
        );
      }

      if (query.customerName) {
        whereConditions.push(
          Prisma.sql`c.name ILIKE ${"%" + query.customerName + "%"}`
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
          Prisma.sql`sku.status ILIKE ${"%" + query.erpStatus + "%"}`
        );
      }

      if (query.sourceDb) {
        whereConditions.push(Prisma.sql`sp.source_db = ${query.sourceDb}`);
      }

      const whereClause = Prisma.join(whereConditions, " AND ");

      // Step 1: Simple base query (~100ms) - no complex CTEs
      const baseQuery = Prisma.sql`
        SELECT DISTINCT ON (sp.source_db, sp.item_no_, c.no_)
          sp.source_db as "sourceDb",
          sku.location_code as "siteCode",
          c.name as "customerName",
          c.bill_to_customer_no_ as "customerBillTo",
          sl.bill_to_customer_no_ as "billToCustomerNo",
          c.contact as "contactName",
          c.e_mail as "contactEmail",
          c.phone_no_ as "contactPhone",
          c.salesperson_code as "salesRep",
          sp.starting_date as "bidStartDate",
          sp.ending_date as "bidEndDate",
          sp.item_no_ as "itemCode",
          i.description as "itemDescription",
          sku.status as "erpStatus",
          sp.customer_bid_qty_ as "bidQuantity"
        FROM dw2_nav.sales_price sp
        INNER JOIN dw2_nav.sales_line sl
          ON sp.source_db = sl.source_db
          AND sp.item_no_ = sl.no_
        LEFT JOIN dw2_nav.customer c
          ON sl.source_db = c.source_db
          AND sl.bill_to_customer_no_ = c.no_
        LEFT JOIN dw2_nav.item i
          ON sp.source_db = i.source_db
          AND sp.item_no_ = i.no_
        LEFT JOIN dw2_nav.stockkeeping_unit sku
          ON sp.source_db = sku.source_db
          AND sp.item_no_ = sku.item_no_
          AND sl.location_code = sku.location_code
        WHERE ${whereClause}
        ORDER BY sp.source_db, sp.item_no_, c.no_, sp.starting_date DESC
        LIMIT ${limit + 1} OFFSET ${offset}
      `;

      const rows = await this.prisma.$queryRaw<BaseBidRow[]>(baseQuery);

      // Calculate hasMore and trim to limit
      const hasMore = rows.length > limit;
      const trimmedRows = hasMore ? rows.slice(0, limit) : rows;

      if (trimmedRows.length === 0) {
        return {
          data: [],
          pagination: { page, limit, hasMore: false },
        };
      }

      // Step 2: Extract unique tuples for lookup queries
      const tuples = trimmedRows.map((r) => ({
        sourceDb: r.sourceDb,
        itemNo: r.itemCode,
        customerNo: r.billToCustomerNo,
      }));

      // Tuples with siteCode for sales lookup (location-specific)
      const salesTuples = trimmedRows.map((r) => ({
        sourceDb: r.sourceDb,
        siteCode: r.siteCode,
        itemNo: r.itemCode,
        customerNo: r.billToCustomerNo,
      }));

      // Calculate month boundaries for previous school year
      // Previous school year starts in August of (currentYear - 1)
      const prevYearCalendarYear = previousYearStart.getFullYear();
      const augustStart = new Date(prevYearCalendarYear, 7, 1); // Aug 1
      const augustEnd = new Date(prevYearCalendarYear, 8, 1); // Sep 1
      const septemberStart = new Date(prevYearCalendarYear, 8, 1); // Sep 1
      const septemberEnd = new Date(prevYearCalendarYear, 9, 1); // Oct 1
      const octoberStart = new Date(prevYearCalendarYear, 9, 1); // Oct 1
      const octoberEnd = new Date(prevYearCalendarYear, 10, 1); // Nov 1

      // Step 3: Run lookup queries in parallel for won/lost calculation and sales
      const [
        currentYearItems,
        previousYearBids,
        lastYearActualSales,
        lastYearAugustSales,
        lastYearSeptemberSales,
        lastYearOctoberSales,
      ] = await Promise.all([
        this.getCurrentYearItems(tuples, currentYearStart, currentYearEnd),
        this.getPreviousYearBids(tuples, previousYearStart, previousYearEnd),
        this.getSalesAmounts(salesTuples, previousYearStart, previousYearEnd),
        this.getSalesAmounts(salesTuples, augustStart, augustEnd),
        this.getSalesAmounts(salesTuples, septemberStart, septemberEnd),
        this.getSalesAmounts(salesTuples, octoberStart, octoberEnd),
      ]);

      // Step 4: Calculate won/lost and build DTOs
      const data: CustomerBidDto[] = trimmedRows.map((row) => {
        const key = `${row.sourceDb}|${row.itemCode}|${row.billToCustomerNo}`;
        const salesKey = `${row.sourceDb}|${row.siteCode}|${row.itemCode}|${row.billToCustomerNo}`;
        const inCurrentYear = currentYearItems.has(key);
        const prevYearBid = previousYearBids.get(key);
        const inPreviousYear = !!prevYearBid;

        // LOST = was in previous year BUT NOT in current year
        const wonLost: "WON" | "LOST" =
          inPreviousYear && !inCurrentYear ? "LOST" : "WON";

        return {
          siteCode: row.siteCode,
          customerName: row.customerName,
          customerBillTo: row.customerBillTo,
          contactName: row.contactName,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          salesRep: row.salesRep,
          wonLost,
          bidStartDate: row.bidStartDate.toISOString(),
          bidEndDate: row.bidEndDate?.toISOString() ?? null,
          itemCode: row.itemCode,
          itemDescription: row.itemDescription,
          erpStatus: row.erpStatus,
          bidQuantity: row.bidQuantity ? Number(row.bidQuantity) : null,
          lastYearBidQty: prevYearBid ? Number(prevYearBid) : null,
          lastYearActual: lastYearActualSales.get(salesKey) ?? null,
          lastYearAugust: lastYearAugustSales.get(salesKey) ?? null,
          lastYearSeptember: lastYearSeptemberSales.get(salesKey) ?? null,
          lastYearOctober: lastYearOctoberSales.get(salesKey) ?? null,
        };
      });

      // Apply wonLost filter if specified (in-memory post-filter)
      const filteredData = query.wonLost
        ? data.filter((d) => d.wonLost === query.wonLost)
        : data;

      logger.info(
        {
          event: "customer-bid.query.success",
          page,
          limit,
          returnedCount: filteredData.length,
          hasMore,
          wonLostFilter: query.wonLost ?? "none",
        },
        "Customer bids fetched successfully"
      );

      return {
        data: filteredData,
        pagination: {
          page,
          limit,
          hasMore,
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
   * Get current year items for the given tuples
   * Returns a Set of keys for fast lookup
   */
  private async getCurrentYearItems(
    tuples: Array<{
      sourceDb: string;
      itemNo: string;
      customerNo: string | null;
    }>,
    currentYearStart: Date,
    currentYearEnd: Date
  ): Promise<Set<string>> {
    if (tuples.length === 0) return new Set();

    // Build tuple conditions for IN clause (handle NULL customerNo correctly)
    const tupleConditions = tuples.map((t) =>
      t.customerNo === null
        ? Prisma.sql`(sp.source_db = ${t.sourceDb} AND sp.item_no_ = ${t.itemNo} AND sl.bill_to_customer_no_ IS NULL)`
        : Prisma.sql`(sp.source_db = ${t.sourceDb} AND sp.item_no_ = ${t.itemNo} AND sl.bill_to_customer_no_ = ${t.customerNo})`
    );

    const query = Prisma.sql`
      SELECT DISTINCT sp.source_db, sp.item_no_, sl.bill_to_customer_no_
      FROM dw2_nav.sales_price sp
      INNER JOIN dw2_nav.sales_line sl
        ON sp.source_db = sl.source_db
        AND sp.item_no_ = sl.no_
      WHERE sp.starting_date >= ${currentYearStart}::date
        AND sp.starting_date < ${currentYearEnd}::date
        AND (${Prisma.join(tupleConditions, " OR ")})
    `;

    const results = await this.prisma.$queryRaw<CurrentYearItem[]>(query);

    return new Set(
      results.map(
        (r) => `${r.source_db}|${r.item_no_}|${r.bill_to_customer_no_}`
      )
    );
  }

  /**
   * Get previous year bid quantities for the given tuples
   * Returns a Map of key -> quantity for fast lookup
   */
  private async getPreviousYearBids(
    tuples: Array<{
      sourceDb: string;
      itemNo: string;
      customerNo: string | null;
    }>,
    previousYearStart: Date,
    previousYearEnd: Date
  ): Promise<Map<string, number>> {
    if (tuples.length === 0) return new Map();

    // Build tuple conditions for IN clause (handle NULL customerNo correctly)
    const tupleConditions = tuples.map((t) =>
      t.customerNo === null
        ? Prisma.sql`(sp.source_db = ${t.sourceDb} AND sp.item_no_ = ${t.itemNo} AND sl.bill_to_customer_no_ IS NULL)`
        : Prisma.sql`(sp.source_db = ${t.sourceDb} AND sp.item_no_ = ${t.itemNo} AND sl.bill_to_customer_no_ = ${t.customerNo})`
    );

    const query = Prisma.sql`
      SELECT DISTINCT ON (sp.source_db, sp.item_no_, sl.bill_to_customer_no_)
        sp.source_db, sp.item_no_, sl.bill_to_customer_no_, sp.customer_bid_qty_
      FROM dw2_nav.sales_price sp
      INNER JOIN dw2_nav.sales_line sl
        ON sp.source_db = sl.source_db
        AND sp.item_no_ = sl.no_
      WHERE sp.starting_date >= ${previousYearStart}::date
        AND sp.starting_date < ${previousYearEnd}::date
        AND (${Prisma.join(tupleConditions, " OR ")})
      ORDER BY sp.source_db, sp.item_no_, sl.bill_to_customer_no_, sp.starting_date DESC
    `;

    const results = await this.prisma.$queryRaw<PreviousYearBid[]>(query);

    const map = new Map<string, number>();
    for (const r of results) {
      const key = `${r.source_db}|${r.item_no_}|${r.bill_to_customer_no_}`;
      map.set(key, r.customer_bid_qty_ ? Number(r.customer_bid_qty_) : 0);
    }
    return map;
  }

  /**
   * Get sales amounts from SalesInvoiceHeader/SalesLine for given tuples and date range
   * Returns a Map of key (sourceDb|siteCode|itemNo|customerNo) -> total amount
   */
  private async getSalesAmounts(
    tuples: Array<{
      sourceDb: string;
      siteCode: string | null;
      itemNo: string;
      customerNo: string | null;
    }>,
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, number>> {
    if (tuples.length === 0) return new Map();

    // Build tuple conditions for IN clause (handle NULL values correctly)
    const tupleConditions = tuples.map((t) => {
      const siteCondition =
        t.siteCode === null
          ? Prisma.sql`sih.location_code IS NULL`
          : Prisma.sql`sih.location_code = ${t.siteCode}`;
      const customerCondition =
        t.customerNo === null
          ? Prisma.sql`sih.bill_to_customer_no_ IS NULL`
          : Prisma.sql`sih.bill_to_customer_no_ = ${t.customerNo}`;

      return Prisma.sql`(sih.source_db = ${t.sourceDb} AND ${siteCondition} AND sl.no_ = ${t.itemNo} AND ${customerCondition})`;
    });

    const query = Prisma.sql`
      SELECT
        sih.source_db,
        sih.location_code,
        sl.no_ as item_no_,
        sih.bill_to_customer_no_,
        SUM(sl.amount) as total_amount
      FROM dw2_nav.sales_invoice_header sih
      INNER JOIN dw2_nav.sales_line sl
        ON sih.source_db = sl.source_db
        AND sih.no_ = sl.document_no_
      WHERE sih.posting_date >= ${startDate}::date
        AND sih.posting_date < ${endDate}::date
        AND (${Prisma.join(tupleConditions, " OR ")})
      GROUP BY sih.source_db, sih.location_code, sl.no_, sih.bill_to_customer_no_
    `;

    const results = await this.prisma.$queryRaw<SalesLookupResult[]>(query);

    const map = new Map<string, number>();
    for (const r of results) {
      const key = `${r.source_db}|${r.location_code}|${r.item_no_}|${r.bill_to_customer_no_}`;
      map.set(key, r.total_amount ? Number(r.total_amount) : 0);
    }
    return map;
  }

  /**
   * Calculate school year boundaries based on current date
   *
   * School Year Definition: Aug 1 - Jun 30
   * - Previous School Year: 08/01/(CURRENT_YEAR-1) to 06/30/CURRENT_YEAR
   * - Current School Year: 08/01/CURRENT_YEAR to 06/30/(CURRENT_YEAR+1)
   * - Next School Year: 08/01/(CURRENT_YEAR+1) to 06/30/(CURRENT_YEAR+2)
   * - If current month is Jan-Jul, shift years back by 1
   */
  private getSchoolYearBoundaries(): {
    currentYearStart: Date;
    currentYearEnd: Date;
    previousYearStart: Date;
    previousYearEnd: Date;
    nextYearEnd: Date;
  } {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)
    let currentYear = now.getFullYear();

    // If Jan-Jul (months 0-6), we're in the second half of the school year
    // Shift years back by 1
    if (currentMonth < 7) {
      currentYear -= 1;
    }

    // Current school year: Aug 1 of currentYear to Jun 30 of currentYear+1
    const currentYearStart = new Date(currentYear, 7, 1); // Aug 1
    const currentYearEnd = new Date(currentYear + 1, 5, 30); // Jun 30

    // Previous school year: Aug 1 of currentYear-1 to Jun 30 of currentYear
    const previousYearStart = new Date(currentYear - 1, 7, 1); // Aug 1
    const previousYearEnd = new Date(currentYear, 5, 30); // Jun 30

    // Next school year end: Jun 30 of currentYear+2
    const nextYearEnd = new Date(currentYear + 2, 5, 30); // Jun 30

    return {
      currentYearStart,
      currentYearEnd,
      previousYearStart,
      previousYearEnd,
      nextYearEnd,
    };
  }
}
