/**
 * Shared key utilities for CustomerBidData.
 * Used by CustomerBidService and BidExportService.
 */

/** 5-field composite key (for sync upserts via unique constraint) */
export interface BidCompositeKey {
  sourceDb: string;
  siteCode: string;
  customerBillTo: string;
  itemNo: string;
  schoolYear: string;
}

/** Build Prisma WHERE for the 5-field unique constraint (used in sync/upsert) */
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

/** Build Prisma WHERE for UUID PK (used in API operations) */
export function buildIdWhere(id: string) {
  return { id };
}
