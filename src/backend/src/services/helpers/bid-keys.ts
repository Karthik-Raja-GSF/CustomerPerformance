/**
 * Shared composite-key utilities for CustomerBidData.
 * Used by CustomerBidService and BidExportService.
 */

/** 5-field composite key shape */
export interface BidCompositeKey {
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
}

/** Build Prisma WHERE for the 5-field composite PK */
export function buildCompositeKeyWhere(key: BidCompositeKey) {
  return {
    sourceDb_siteCode_customerBillTo_itemNo_schoolYear: {
      sourceDb: key.sourceDb,
      siteCode: key.siteCode,
      customerBillTo: key.customerBillTo,
      itemNo: key.itemNo,
      schoolYear: key.schoolYear,
    },
  };
}

/** Build pipe-delimited map key (for sync lookups) */
export function buildMapKey(
  sourceDb: string,
  siteCode: string,
  customerBillTo: string,
  itemNo: string
): string {
  return `${sourceDb}|${siteCode}|${customerBillTo}|${itemNo}`;
}
