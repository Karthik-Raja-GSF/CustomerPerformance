import * as XLSX from "xlsx";
import type { CustomerBidDto } from "@/types/customer-bids";

export interface ExportColumn {
  key: string;
  header: string;
}

/**
 * SIQ row format for demand export
 */
interface SIQRow {
  "Item Code": string;
  "Site Code": string;
  "Customer Ship To Code": string;
  "Demand Date": string;
  Quantity: number;
  Note: string;
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
        const value = (row as Record<string, unknown>)[col.key];
        // Format boolean values for readability
        if (typeof value === "boolean") {
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
 * Monthly estimate configuration for SIQ export
 */
const SIQ_ESTIMATE_MONTHS = [
  { key: "estimateJan" as const, month: 1, label: "01" },
  { key: "estimateFeb" as const, month: 2, label: "02" },
  { key: "estimateMar" as const, month: 3, label: "03" },
  { key: "estimateApr" as const, month: 4, label: "04" },
  { key: "estimateMay" as const, month: 5, label: "05" },
  { key: "estimateJun" as const, month: 6, label: "06" },
  { key: "estimateJul" as const, month: 7, label: "07" },
  { key: "estimateAug" as const, month: 8, label: "08" },
  { key: "estimateSep" as const, month: 9, label: "09" },
  { key: "estimateOct" as const, month: 10, label: "10" },
  { key: "estimateNov" as const, month: 11, label: "11" },
  { key: "estimateDec" as const, month: 12, label: "12" },
];

/**
 * Export customer bids to SIQ CSV format
 *
 * Transforms each bid record into up to 12 rows (one per estimate month).
 * Only includes rows where the estimate quantity is greater than 0.
 *
 * SIQ Format:
 * - Item Code: itemCode
 * - Site Code: siteCode
 * - Customer Ship To Code: customerBillTo
 * - Demand Date: MM/01/YYYY (1st of each month)
 * - Quantity: estimate value
 * - Note: customerName
 */
export function exportToSIQCSV(data: CustomerBidDto[], filename: string): void {
  const nextYear = new Date().getFullYear() + 1;
  const siqRows: SIQRow[] = [];

  for (const row of data) {
    const baseRow = {
      "Item Code": row.itemCode || "",
      "Site Code": row.siteCode || "",
      "Customer Ship To Code": row.customerBillTo || "",
      Note: row.customerName || "",
    };

    // Iterate through all 12 estimate months
    for (const monthConfig of SIQ_ESTIMATE_MONTHS) {
      const estimateValue = row[monthConfig.key];
      if (estimateValue != null && estimateValue > 0) {
        siqRows.push({
          ...baseRow,
          "Demand Date": `${monthConfig.label}/01/${nextYear}`,
          Quantity: estimateValue,
        });
      }
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(siqRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SIQ");

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}-${timestamp}.csv`);
}

/**
 * Column configuration for Customer Bids export
 * Exports ALL fields regardless of table column visibility
 */
export const customerBidExportColumns: ExportColumn[] = [
  // Customer info
  { key: "sourceDb", header: "Source" },
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
  { key: "erpStatus", header: "ERP Status" },
  // Bid info
  { key: "isLost", header: "Lost" },
  { key: "bidStartDate", header: "Bid Start" },
  { key: "bidEndDate", header: "Bid End" },
  { key: "bidQuantity", header: "Bid Qty" },
  // Last year data
  { key: "lastYearBidQty", header: "LY Bid Qty" },
  { key: "lastYearActual", header: "LY Actual" },
  { key: "lyAugust", header: "LY August" },
  { key: "lySeptember", header: "LY September" },
  { key: "lyOctober", header: "LY October" },
  // User-editable fields (always included)
  { key: "confirmedAt", header: "Confirmed At" },
  { key: "confirmedBy", header: "Confirmed By" },
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
  // Menu months
  { key: "menuJan", header: "Menu Jan" },
  { key: "menuFeb", header: "Menu Feb" },
  { key: "menuMar", header: "Menu Mar" },
  { key: "menuApr", header: "Menu Apr" },
  { key: "menuMay", header: "Menu May" },
  { key: "menuJun", header: "Menu Jun" },
  { key: "menuJul", header: "Menu Jul" },
  { key: "menuAug", header: "Menu Aug" },
  { key: "menuSep", header: "Menu Sep" },
  { key: "menuOct", header: "Menu Oct" },
  { key: "menuNov", header: "Menu Nov" },
  { key: "menuDec", header: "Menu Dec" },
];
