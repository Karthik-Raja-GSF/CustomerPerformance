/**
 * SIQ Import DTOs - Data Transfer Objects for API layer
 *
 * All timestamps are in UTC with ISO8601 format (e.g., "2025-01-15T14:30:00.000Z")
 */

export interface ImportLogDto {
  id: string;
  fileName: string;
  /** ISO8601 UTC timestamp */
  importDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  rowsProcessed: number | null;
  rowsCreated: number | null;
  rowsUpdated: number | null;
  rowsFailed: number | null;
  errorLog: string | null;
  /** ISO8601 UTC timestamp */
  createdAt: string;
  /** ISO8601 UTC timestamp */
  completedAt: string | null;
}

export interface ImportStatsDto {
  rowsProcessed: number;
  sitesCreated: number;
  sitesUpdated: number;
  suppliersCreated: number;
  suppliersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  inventorySnapshotsCreated: number;
  salesActualsCreated: number;
  salesActualsUpdated: number;
  forecastsCreated: number;
  forecastsUpdated: number;
  customerMetricsCreated: number;
}

export interface ImportResultDto {
  importId: string;
  status: 'COMPLETED' | 'FAILED';
  stats: ImportStatsDto;
  errors?: string[];
  /** ISO8601 UTC timestamp */
  completedAt: string;
}

export interface SiteDto {
  id: string;
  code: string;
  company: string;
  /** ISO8601 UTC timestamp */
  createdAt: string;
  /** ISO8601 UTC timestamp */
  updatedAt: string;
}

export interface SupplierDto {
  id: string;
  code: string;
  name: string;
  /** ISO8601 UTC timestamp */
  createdAt: string;
  /** ISO8601 UTC timestamp */
  updatedAt: string;
}

export interface ItemDto {
  id: string;
  code: string;
  description: string;
  categoryClass: string | null;
  zone: string | null;
  erpStatus: string | null;
  abcClass: string | null;
  shelfLifeDays: number | null;
  leadTimeDays: number | null;
  conditionalStatus: string | null;
  challengeStatus: string | null;
  siteId: string;
  supplierId: string | null;
  /** ISO8601 UTC timestamp */
  createdAt: string;
  /** ISO8601 UTC timestamp */
  updatedAt: string;
}

export interface InventorySnapshotDto {
  id: string;
  itemId: string;
  siteId: string;
  onHandQty: number;
  safetyStock: number | null;
  onOrder: number | null;
  openSales: number | null;
  openEstimates: number | null;
  targetStock: number | null;
  preferredMax: number | null;
  maxStock: number | null;
  weeksSupply: number | null;
  /** ISO8601 UTC timestamp */
  nextPoDate: string | null;
  nextPoQty: number | null;
  /** ISO8601 UTC timestamp */
  snapshotDate: string;
  /** ISO8601 UTC timestamp */
  createdAt: string;
}

export interface SalesActualDto {
  id: string;
  itemId: string;
  siteId: string;
  periodType: string;
  periodLabel: string;
  /** ISO8601 UTC timestamp */
  periodDate: string;
  quantity: number;
  /** ISO8601 UTC timestamp */
  createdAt: string;
}

export interface ForecastDto {
  id: string;
  itemId: string;
  siteId: string;
  /** ISO8601 UTC timestamp */
  forecastMonth: string;
  predictedQty: number;
  variancePct: number | null;
  supplyVariance: number | null;
  /** ISO8601 UTC timestamp */
  createdAt: string;
}

export interface CustomerMetricDto {
  id: string;
  itemId: string;
  totalCustomers: number | null;
  topCustomers: string | null;
  buyer: string | null;
  /** ISO8601 UTC timestamp */
  snapshotDate: string;
  /** ISO8601 UTC timestamp */
  createdAt: string;
}
