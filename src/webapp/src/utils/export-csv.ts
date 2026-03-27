import * as XLSX from "xlsx";
import type { CustomerBidDto } from "@/types/customer-bids";
import {
  ESTIMATE_MONTHS,
  LY_MONTHS,
  CY_MONTHS,
  YEAR_AROUND_ESTIMATE_MONTHS,
  type MonthKey,
} from "@/utils/menu-months";
import type { VisibilityState } from "@/pages/customer-bids/data-table";

export interface ExportColumn {
  key: string;
  header: string;
  format?: (value: unknown) => string;
  /** Compute value from the full row (for derived/calculated columns) */
  computeValue?: (row: Record<string, unknown>) => unknown;
}

/**
 * Maps table column IDs to the export column keys they control.
 * Composite table columns (e.g. "estimates") map to multiple export keys.
 * Simple columns map to themselves (identity mapping) and are handled by default.
 */
const TABLE_COLUMN_TO_EXPORT_KEYS: Record<string, string[]> = {
  estimates: ESTIMATE_MONTHS.map((m) => m.estimateKey),
  lyMonths: LY_MONTHS.map((m) => m.lyKey),
  cyYtd: ["cyYtd"],
  currentAvg: ["currentAvg"],
  menuMonths: [], // virtual UI-only column, no export counterpart
  confirmed: ["confirmedAt"],
  lastUpdated: ["lastUpdatedAt", "lastUpdatedBy"],
  conversionRate: ["conversionRate"],
  isNew: ["isNew"],
};

/**
 * NAV row format for demand export
 */
interface NAVRow {
  "Customer No.": string;
  "Item No.": string;
  "Starting Date": string;
  "Ending Date": string;
  Quantity: number;
}

/**
 * Export data to CSV file using SheetJS (xlsx)
 *
 * @param data - Array of objects to export
 * @param columns - Column configuration with keys and display headers
 * @param filename - Base filename (timestamp will be appended)
 */
export function exportToCSV<T extends object>(
  data: T[],
  columns: ExportColumn[],
  filename: string
): void {
  // Map data to only include specified columns with display headers
  const exportData = data.map((row) =>
    columns.reduce(
      (acc, col) => {
        const value = col.computeValue
          ? col.computeValue(row as Record<string, unknown>)
          : (row as Record<string, unknown>)[col.key];
        // Use custom format function if provided
        if (col.format) {
          acc[col.header] = col.format(value);
        } else if (typeof value === "boolean") {
          acc[col.header] = value ? "Yes" : "No";
        } else if (value === null || value === undefined) {
          acc[col.header] = "";
        } else {
          acc[col.header] = value;
        }
        return acc;
      },
      {} as Record<string, unknown>
    )
  );

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}-${timestamp}.csv`);
}

/**
 * Monthly estimate configuration for NAV export.
 * yearOffset: 0 = start year of school year (Jul-Dec), 1 = end year (Jan-Jun)
 */
const NAV_ESTIMATE_MONTHS = [
  { key: "estimateJan" as const, month: 1, yearOffset: 1 },
  { key: "estimateFeb" as const, month: 2, yearOffset: 1 },
  { key: "estimateMar" as const, month: 3, yearOffset: 1 },
  { key: "estimateApr" as const, month: 4, yearOffset: 1 },
  { key: "estimateMay" as const, month: 5, yearOffset: 1 },
  { key: "estimateJun" as const, month: 6, yearOffset: 1 },
  { key: "estimateJul" as const, month: 7, yearOffset: 0 },
  { key: "estimateAug" as const, month: 8, yearOffset: 0 },
  { key: "estimateSep" as const, month: 9, yearOffset: 0 },
  { key: "estimateOct" as const, month: 10, yearOffset: 0 },
  { key: "estimateNov" as const, month: 11, yearOffset: 0 },
  { key: "estimateDec" as const, month: 12, yearOffset: 0 },
];

/**
 * Export customer bids to NAV CSV format
 *
 * Transforms each bid record into up to 12 rows (one per estimate month).
 * Only includes rows where the estimate quantity is greater than 0.
 *
 * NAV Format:
 * - Customer No.: customerBillTo
 * - Item No.: itemCode
 * - Starting Date: MM/01/YYYY (first day of month, 4-digit year)
 * - Ending Date: MM/DD/YYYY (last day of month, 4-digit year)
 * - Quantity: estimate value
 *
 * Year is derived from schoolYearString (e.g. "2025-2026"):
 * - Jul-Dec use the start year (2025)
 * - Jan-Jun use the end year (2026)
 */
export function exportToNAVCSV(
  data: CustomerBidDto[],
  filename: string,
  schoolYearString: string,
  getMenuMonths?: (bid: CustomerBidDto) => Record<MonthKey, boolean>
): void {
  const startYear = parseInt(schoolYearString.split("-")[0] ?? "0", 10);
  const navRows: NAVRow[] = [];

  for (const row of data) {
    // When getMenuMonths is provided, build the set of allowed estimate keys for this row
    let allowedEstimateKeys: Set<string> | null = null;
    if (getMenuMonths) {
      allowedEstimateKeys = new Set<string>();
      if (row.yearAround) {
        for (const yaKey of YEAR_AROUND_ESTIMATE_MONTHS) {
          const month = ESTIMATE_MONTHS.find((m) => m.menuKey === yaKey);
          if (month) allowedEstimateKeys.add(month.estimateKey);
        }
      } else {
        const months = getMenuMonths(row);
        for (const m of ESTIMATE_MONTHS) {
          if (months[m.menuKey]) {
            allowedEstimateKeys.add(m.estimateKey);
          }
        }
      }
    }

    for (const monthConfig of NAV_ESTIMATE_MONTHS) {
      if (allowedEstimateKeys && !allowedEstimateKeys.has(monthConfig.key)) {
        continue;
      }
      const estimateValue = row[monthConfig.key];
      if (estimateValue != null && estimateValue > 0) {
        const year = startYear + monthConfig.yearOffset;
        const yyyy = String(year);
        const mm = String(monthConfig.month).padStart(2, "0");
        const lastDay = new Date(year, monthConfig.month, 0).getDate();
        navRows.push({
          "Customer No.": row.customerBillTo || "",
          "Item No.": row.itemCode || "",
          "Starting Date": `${mm}/01/${yyyy}`,
          "Ending Date": `${mm}/${String(lastDay).padStart(2, "0")}/${yyyy}`,
          Quantity: estimateValue,
        });
      }
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(navRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "NAV");

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}-${timestamp}.csv`);
}

/**
 * Build the set of export column keys that should be excluded given the
 * current table column visibility state.
 *
 * Columns not explicitly set in the visibility map default to **visible**
 * (TanStack convention).  An export key is only disallowed when BOTH
 * its individual column AND every composite column that covers it are hidden.
 * This lets the composite "LY Months" column keep LY export keys visible
 * even though the individual lyAugust…lyJuly toggles are off by default.
 */
function getAllowedExportKeys(
  columnVisibility: VisibilityState
): Set<string> | null {
  // Reverse lookup: export key → composite table column IDs that include it
  const exportKeyToComposites = new Map<string, string[]>();
  for (const [tableColId, exportKeys] of Object.entries(
    TABLE_COLUMN_TO_EXPORT_KEYS
  )) {
    for (const ek of exportKeys) {
      const list = exportKeyToComposites.get(ek) ?? [];
      list.push(tableColId);
      exportKeyToComposites.set(ek, list);
    }
  }

  const disallowedKeys = new Set<string>();

  for (const [tableColId, visible] of Object.entries(columnVisibility)) {
    if (visible !== false) continue;

    const mappedKeys = TABLE_COLUMN_TO_EXPORT_KEYS[tableColId];
    if (mappedKeys) {
      // Composite column hidden — hide its keys only if no other
      // visible composite also covers them
      for (const k of mappedKeys) {
        const composites = exportKeyToComposites.get(k) ?? [];
        const anyCompositeVisible = composites.some(
          (c) => columnVisibility[c] !== false
        );
        if (!anyCompositeVisible) disallowedKeys.add(k);
      }
    } else {
      // Simple 1:1 column — but if a visible composite covers this key,
      // keep it in the export
      const composites = exportKeyToComposites.get(tableColId);
      if (composites) {
        const anyCompositeVisible = composites.some(
          (c) => columnVisibility[c] !== false
        );
        if (!anyCompositeVisible) disallowedKeys.add(tableColId);
      } else {
        disallowedKeys.add(tableColId);
      }
    }
  }

  return disallowedKeys.size > 0 ? disallowedKeys : null;
}

/**
 * Build a filtered export column list that:
 * 1. Respects table column visibility (hidden columns are excluded)
 * 2. Only includes estimate and LY columns for months selected in menu months
 */
export function buildFilteredExportColumns(
  bids: CustomerBidDto[],
  getMenuMonths: (bid: CustomerBidDto) => Record<MonthKey, boolean>,
  columnVisibility?: VisibilityState
): ExportColumn[] {
  // --- Step 1: column visibility filter ---
  const disallowedKeys = columnVisibility
    ? getAllowedExportKeys(columnVisibility)
    : null;

  // --- Step 2: menu-month filter for estimate & LY columns ---
  const selectedMonths = new Set<MonthKey>();
  for (const bid of bids) {
    if (bid.yearAround) {
      for (const key of YEAR_AROUND_ESTIMATE_MONTHS) {
        selectedMonths.add(key);
      }
    } else {
      const months = getMenuMonths(bid);
      for (const [key, selected] of Object.entries(months)) {
        if (selected) selectedMonths.add(key as MonthKey);
      }
    }
  }

  const allowedEstimateKeys = new Set<string>();
  const allowedLyKeys = new Set<string>();
  const allowedCyKeys = new Set<string>();
  for (const m of ESTIMATE_MONTHS) {
    if (selectedMonths.has(m.menuKey)) allowedEstimateKeys.add(m.estimateKey);
  }
  for (const m of LY_MONTHS) {
    if (selectedMonths.has(m.menuKey)) allowedLyKeys.add(m.lyKey);
  }
  for (const m of CY_MONTHS) {
    if (selectedMonths.has(m.menuKey)) allowedCyKeys.add(m.cyKey);
  }

  const allEstimateKeys = new Set<string>(
    ESTIMATE_MONTHS.map((m) => m.estimateKey)
  );
  const allLyKeys = new Set<string>(LY_MONTHS.map((m) => m.lyKey));
  const allCyKeys = new Set<string>(CY_MONTHS.map((m) => m.cyKey));

  return customerBidExportColumns.filter((col) => {
    // Check column visibility first
    if (disallowedKeys?.has(col.key)) return false;

    // Then apply menu-month filtering for estimate/LY/CY columns
    if (allEstimateKeys.has(col.key)) return allowedEstimateKeys.has(col.key);
    if (allLyKeys.has(col.key)) return allowedLyKeys.has(col.key);
    if (allCyKeys.has(col.key)) return allowedCyKeys.has(col.key);
    return true;
  });
}

export const customerBidExportColumns: ExportColumn[] = [
  // Customer info
  { key: "sourceDb", header: "Source" },
  { key: "schoolYear", header: "School Year" },
  { key: "siteCode", header: "Site Code" },
  { key: "customerName", header: "Customer Name" },
  { key: "customerBillTo", header: "Customer Bill To" },
  { key: "coOpCode", header: "Co-op Code" },
  { key: "contactName", header: "Contact Name" },
  { key: "contactEmail", header: "Contact Email" },
  { key: "contactPhone", header: "Contact Phone" },
  { key: "salesRep", header: "Sales Rep" },
  // Item info
  { key: "itemCode", header: "Item Code" },
  { key: "itemDescription", header: "Item Description" },
  { key: "brandName", header: "Brand Name" },
  { key: "packSize", header: "Pack Size" },
  { key: "customerLeadTime", header: "Lead Time" },
  { key: "erpStatus", header: "ERP Status" },
  // Bid info
  {
    key: "isNew",
    header: "Renewed/New",
    format: (v) => (v ? "New" : "Renewed"),
  },
  { key: "bidStartDate", header: "Bid Start" },
  { key: "bidEndDate", header: "Bid End" },
  { key: "bidQuantity", header: "Bid Qty" },
  // Last year data
  { key: "lastYearBidQty", header: "LY Bid Qty" },
  { key: "lastYearActual", header: "LY Actual" },
  {
    key: "conversionRate",
    header: "Conversion Rate (%)",
    computeValue: (row) => {
      const lyActual = row.lastYearActual as number | null;
      const lyBidQty = row.lastYearBidQty as number | null;
      if (!lyBidQty || lyActual == null) return "";
      return ((lyActual / lyBidQty) * 100).toFixed(1);
    },
  },
  { key: "lyAugust", header: "LY August" },
  { key: "lySeptember", header: "LY September" },
  { key: "lyOctober", header: "LY October" },
  { key: "lyNovember", header: "LY November" },
  { key: "lyDecember", header: "LY December" },
  { key: "lyJanuary", header: "LY January" },
  { key: "lyFebruary", header: "LY February" },
  { key: "lyMarch", header: "LY March" },
  { key: "lyApril", header: "LY April" },
  { key: "lyMay", header: "LY May" },
  { key: "lyJune", header: "LY June" },
  { key: "lyJuly", header: "LY July" },
  // Current year monthly actuals
  { key: "cyAugust", header: "CY August" },
  { key: "cySeptember", header: "CY September" },
  { key: "cyOctober", header: "CY October" },
  { key: "cyNovember", header: "CY November" },
  { key: "cyDecember", header: "CY December" },
  { key: "cyJanuary", header: "CY January" },
  { key: "cyFebruary", header: "CY February" },
  { key: "cyMarch", header: "CY March" },
  { key: "cyApril", header: "CY April" },
  { key: "cyMay", header: "CY May" },
  { key: "cyJune", header: "CY June" },
  { key: "cyJuly", header: "CY July" },
  {
    key: "cyYtd",
    header: "YTD Usage",
    computeValue: (row) => {
      const fields = [
        "cyAugust",
        "cySeptember",
        "cyOctober",
        "cyNovember",
        "cyDecember",
        "cyJanuary",
        "cyFebruary",
        "cyMarch",
        "cyApril",
        "cyMay",
        "cyJune",
        "cyJuly",
      ];
      const sum = fields.reduce((acc, f) => acc + ((row[f] as number) ?? 0), 0);
      return sum > 0 ? sum : "";
    },
  },
  {
    key: "currentAvg",
    header: "Current Avg",
    computeValue: (row) => {
      const schoolYearMonths: { month: number; field: string }[] = [
        { month: 7, field: "cyJuly" },
        { month: 8, field: "cyAugust" },
        { month: 9, field: "cySeptember" },
        { month: 10, field: "cyOctober" },
        { month: 11, field: "cyNovember" },
        { month: 12, field: "cyDecember" },
        { month: 1, field: "cyJanuary" },
        { month: 2, field: "cyFebruary" },
        { month: 3, field: "cyMarch" },
        { month: 4, field: "cyApril" },
        { month: 5, field: "cyMay" },
        { month: 6, field: "cyJune" },
      ];
      const currentMonth = new Date().getMonth() + 1;
      let elapsed = 0;
      let sum = 0;
      for (const m of schoolYearMonths) {
        elapsed++;
        sum += (row[m.field] as number) ?? 0;
        if (m.month === currentMonth) break;
      }
      if (elapsed === 0) return "";
      const avg = sum / elapsed;
      return avg > 0 ? Math.round(avg) : "";
    },
  },
  // Tracking fields
  { key: "lastUpdatedAt", header: "Last Updated At" },
  { key: "lastUpdatedBy", header: "Last Updated By" },
  {
    key: "confirmedAt",
    header: "Confirmed",
    format: (v) => (v ? "Yes" : "No"),
  },
  { key: "yearAround", header: "Year Around" },
  // Monthly estimates
  { key: "estimateJan", header: "Jan Estimate" },
  { key: "estimateFeb", header: "Feb Estimate" },
  { key: "estimateMar", header: "Mar Estimate" },
  { key: "estimateApr", header: "Apr Estimate" },
  { key: "estimateMay", header: "May Estimate" },
  { key: "estimateJun", header: "Jun Estimate" },
  { key: "estimateJul", header: "Jul Estimate" },
  { key: "estimateAug", header: "Aug Estimate" },
  { key: "estimateSep", header: "Sep Estimate" },
  { key: "estimateOct", header: "Oct Estimate" },
  { key: "estimateNov", header: "Nov Estimate" },
  { key: "estimateDec", header: "Dec Estimate" },
];
