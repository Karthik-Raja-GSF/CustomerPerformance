/**
 * Shared conversion helpers for customer bid records.
 * Decimal ↔ number, estimate field constants, batch mapping.
 */
import type { Prisma } from "@prisma/client";

/** All 12 monthly estimate field names */
export const ESTIMATE_FIELDS = [
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

export type EstimateField = (typeof ESTIMATE_FIELDS)[number];

/** Convert Prisma.Decimal | null → number | null */
export function decimalToNumber(
  val: Prisma.Decimal | null | undefined
): number | null {
  return val != null ? Number(val) : null;
}

/** Map all 12 estimate fields from a record to number | null */
export function mapEstimates(
  record: Partial<Record<EstimateField, Prisma.Decimal | null>>
): Record<EstimateField, number | null> {
  const result = {} as Record<EstimateField, number | null>;
  for (const field of ESTIMATE_FIELDS) {
    result[field] = decimalToNumber(record[field] ?? null);
  }
  return result;
}
