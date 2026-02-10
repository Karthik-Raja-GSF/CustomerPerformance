/**
 * CSV Import Utility for Customer Bids
 *
 * Parses exported CSV/XLSX files, reverse-maps headers to DTO field names,
 * validates data, and prepares records for the bulk-update API.
 */

import * as XLSX from "xlsx";
import { customerBidExportColumns } from "@/utils/export-csv";
import type {
  CustomerBidKey,
  UpdateCustomerBidDto,
} from "@/types/customer-bids";

export interface ParsedImportRow {
  /** 1-based row number in the source file (for error reporting) */
  rowNumber: number;
  key: CustomerBidKey;
  updates: UpdateCustomerBidDto;
}

export interface ImportValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ParsedImportResult {
  records: ParsedImportRow[];
  errors: ImportValidationError[];
  totalRows: number;
  skippedRows: number;
  duplicateRows: number;
}

/** Fields the user can edit (menu months are derived from estimates, not imported directly) */
const EDITABLE_FIELDS: string[] = [
  "confirmed",
  "yearAround",
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
];

const BOOLEAN_FIELDS = new Set<string>(["confirmed", "yearAround"]);

const ESTIMATE_FIELDS = new Set<string>([
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
]);

/**
 * Build a case-insensitive header → key map from the export column config.
 * e.g. "jan estimate" → "estimateJan"
 */
function buildHeaderToKeyMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const col of customerBidExportColumns) {
    map.set(col.header.toLowerCase(), col.key);
  }
  return map;
}

const HEADER_TO_KEY = buildHeaderToKeyMap();
// Export uses { key: "confirmedAt", header: "Confirmed" } which maps
// "confirmed" → "confirmedAt". Override so import maps it to the virtual
// "confirmed" boolean field instead.
HEADER_TO_KEY.set("confirmed", "confirmed");

/** Required header names (display names from export) */
const REQUIRED_HEADERS = [
  "Source",
  "Site Code",
  "Customer Bill To",
  "Item Code",
];

function parseBoolean(
  value: unknown,
  fieldKey: string
): { value: boolean | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    // yearAround defaults to false; menu months default to null
    return { value: fieldKey === "yearAround" ? false : null };
  }

  const str = String(value).trim().toLowerCase();
  if (str === "yes" || str === "true" || str === "1") return { value: true };
  if (str === "no" || str === "false" || str === "0") return { value: false };

  return {
    value: null,
    error: `Expected "Yes" or "No", got "${String(value)}"`,
  };
}

function parseNumber(value: unknown): { value: number | null; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { value: null };
  }

  const num = Number(value);
  if (isNaN(num)) {
    return { value: null, error: `Expected a number, got "${String(value)}"` };
  }

  return { value: num };
}

/**
 * Parse a CSV or XLSX file into validated import records.
 *
 * @param file - The uploaded file
 * @param schoolYear - School year string from the page (e.g., "2026-2027")
 * @returns Parsed and validated records ready for bulk-update API
 */
export async function parseImportFile(
  file: File,
  schoolYear: string
): Promise<ParsedImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      records: [],
      errors: [{ row: 0, column: "", message: "File contains no sheets" }],
      totalRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
    };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  if (rawRows.length === 0) {
    return {
      records: [],
      errors: [{ row: 0, column: "", message: "File contains no data rows" }],
      totalRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
    };
  }

  // Validate that required headers exist (case-insensitive)
  const firstRow = rawRows[0]!;

  // Strip BOM from first header if present (Excel "UTF-8 with BOM" CSV files)
  const rawFirstRowKeys = Object.keys(firstRow);
  if (rawFirstRowKeys.length > 0 && rawFirstRowKeys[0]!.startsWith("\uFEFF")) {
    const bomHeader = rawFirstRowKeys[0]!;
    const cleanHeader = bomHeader.replace(/^\uFEFF/, "");
    for (const row of rawRows) {
      if (bomHeader in row) {
        row[cleanHeader] = row[bomHeader];
        delete row[bomHeader];
      }
    }
  }

  const fileHeaders = Object.keys(firstRow);
  const fileHeadersLower = new Set(
    fileHeaders.map((h) => h.trim().toLowerCase())
  );
  const missingHeaders: string[] = [];
  for (const reqHeader of REQUIRED_HEADERS) {
    if (!fileHeadersLower.has(reqHeader.toLowerCase())) {
      missingHeaders.push(reqHeader);
    }
  }
  if (missingHeaders.length > 0) {
    return {
      records: [],
      errors: [
        {
          row: 0,
          column: "",
          message: `Missing required columns: ${missingHeaders.join(", ")}`,
        },
      ],
      totalRows: rawRows.length,
      skippedRows: rawRows.length,
      duplicateRows: 0,
    };
  }

  // Build a map from this file's actual headers (trimmed lowercase) to their original casing
  const headerOriginalCase = new Map<string, string>();
  for (const h of fileHeaders) {
    headerOriginalCase.set(h.trim().toLowerCase(), h);
  }

  const errors: ImportValidationError[] = [];
  const allRecords: ParsedImportRow[] = [];
  let skippedRows = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]!;
    const rowNum = i + 2; // +2 because row 1 is headers, data starts at row 2

    // Helper to get value by DTO key name
    const getValueByKey = (dtoKey: string): unknown => {
      // Find the export header for this key
      for (const [headerLower, key] of HEADER_TO_KEY) {
        if (key === dtoKey) {
          const originalHeader = headerOriginalCase.get(headerLower);
          if (originalHeader && originalHeader in raw) {
            return raw[originalHeader];
          }
          // Try case-insensitive match on raw keys
          for (const rawKey of Object.keys(raw)) {
            if (rawKey.toLowerCase() === headerLower) {
              return raw[rawKey];
            }
          }
          return undefined;
        }
      }
      return undefined;
    };

    // --- Extract composite key ---
    const sourceDb = String(getValueByKey("sourceDb") ?? "").trim();
    const siteCode = String(getValueByKey("siteCode") ?? "").trim();
    const customerBillTo = String(getValueByKey("customerBillTo") ?? "").trim();
    const itemCode = String(getValueByKey("itemCode") ?? "").trim();

    let keyValid = true;
    if (!sourceDb) {
      errors.push({
        row: rowNum,
        column: "Source",
        message: "Required field is empty",
      });
      keyValid = false;
    }
    if (!siteCode) {
      errors.push({
        row: rowNum,
        column: "Site Code",
        message: "Required field is empty",
      });
      keyValid = false;
    }
    if (!customerBillTo) {
      errors.push({
        row: rowNum,
        column: "Customer Bill To",
        message: "Required field is empty",
      });
      keyValid = false;
    }
    if (!itemCode) {
      errors.push({
        row: rowNum,
        column: "Item Code",
        message: "Required field is empty",
      });
      keyValid = false;
    }

    if (!keyValid) {
      skippedRows++;
      continue;
    }

    const key: CustomerBidKey = {
      sourceDb,
      siteCode,
      customerBillTo,
      itemNo: itemCode, // Frontend uses itemCode, backend key uses itemNo
      schoolYear,
    };

    // --- Extract editable fields ---
    const updates: UpdateCustomerBidDto = {};
    let hasUpdates = false;

    for (const field of EDITABLE_FIELDS) {
      const rawValue = getValueByKey(field);

      // Skip fields that are not present in the CSV or have empty values
      if (rawValue === undefined || rawValue === "") continue;

      // Find the display header name for error messages
      let displayHeader: string = field;
      for (const col of customerBidExportColumns) {
        if (col.key === field) {
          displayHeader = col.header;
          break;
        }
      }

      if (BOOLEAN_FIELDS.has(field)) {
        const parsed = parseBoolean(rawValue, field);
        if (parsed.error) {
          errors.push({
            row: rowNum,
            column: displayHeader,
            message: parsed.error,
          });
        } else if (field === "confirmed" && parsed.value === null) {
          // Empty "Confirmed" column means "don't change status" — skip
          continue;
        } else {
          (updates as Record<string, unknown>)[field] = parsed.value;
          hasUpdates = true;
        }
      } else if (ESTIMATE_FIELDS.has(field)) {
        const parsed = parseNumber(rawValue);
        if (parsed.error) {
          errors.push({
            row: rowNum,
            column: displayHeader,
            message: parsed.error,
          });
        } else {
          (updates as Record<string, unknown>)[field] = parsed.value;
          hasUpdates = true;
        }
      }
    }

    // --- Year Around validation: Aug/Sep/Oct estimates are required ---
    const yearAround = (updates as Record<string, unknown>).yearAround;
    if (yearAround === true) {
      const requiredMonths = [
        { field: "estimateAug", header: "Aug Estimate" },
        { field: "estimateSep", header: "Sep Estimate" },
        { field: "estimateOct", header: "Oct Estimate" },
      ];
      for (const { field, header } of requiredMonths) {
        const val = (updates as Record<string, unknown>)[field];
        if (val == null || val === 0) {
          errors.push({
            row: rowNum,
            column: header,
            message: "Required when Year Around is Yes",
          });
        }
      }
    }

    if (!hasUpdates) {
      skippedRows++;
      continue;
    }

    allRecords.push({ rowNumber: rowNum, key, updates });
  }

  // --- Deduplicate by composite key (keep last occurrence) ---
  const keyToIndex = new Map<string, number>();
  let duplicateRows = 0;

  for (let i = 0; i < allRecords.length; i++) {
    const k = allRecords[i]!.key;
    const compositeKey = `${k.sourceDb}/${k.siteCode}/${k.customerBillTo}/${k.itemNo}`;
    if (keyToIndex.has(compositeKey)) {
      duplicateRows++;
    }
    keyToIndex.set(compositeKey, i);
  }

  // Keep only the last occurrence of each key
  const uniqueIndices = new Set(keyToIndex.values());
  const dedupedRecords = allRecords.filter((_, i) => uniqueIndices.has(i));

  return {
    records: dedupedRecords,
    errors,
    totalRows: rawRows.length,
    skippedRows,
    duplicateRows,
  };
}
