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
 * Export customer bids to SIQ CSV format
 *
 * Transforms each bid record into up to 3 rows (one per demand month).
 * Only includes rows where the demand quantity is greater than 0.
 *
 * SIQ Format:
 * - Item Code: itemCode
 * - Site Code: siteCode
 * - Customer Ship To Code: customerBillTo
 * - Demand Date: MM/DD/YYYY (1st of Aug/Sep/Oct next year)
 * - Quantity: augustDemand/septemberDemand/octoberDemand
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

    // August demand
    if (row.augustDemand != null && row.augustDemand > 0) {
      siqRows.push({
        ...baseRow,
        "Demand Date": `08/01/${nextYear}`,
        Quantity: row.augustDemand,
      });
    }

    // September demand
    if (row.septemberDemand != null && row.septemberDemand > 0) {
      siqRows.push({
        ...baseRow,
        "Demand Date": `09/01/${nextYear}`,
        Quantity: row.septemberDemand,
      });
    }

    // October demand
    if (row.octoberDemand != null && row.octoberDemand > 0) {
      siqRows.push({
        ...baseRow,
        "Demand Date": `10/01/${nextYear}`,
        Quantity: row.octoberDemand,
      });
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
  { key: "confirmed", header: "Confirmed" },
  { key: "yearAround", header: "Year Around" },
  { key: "augustDemand", header: "Aug Estimate" },
  { key: "septemberDemand", header: "Sep Estimate" },
  { key: "octoberDemand", header: "Oct Estimate" },
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
