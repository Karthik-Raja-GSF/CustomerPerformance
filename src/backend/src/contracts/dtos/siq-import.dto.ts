// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// These DTOs were used for the API layer of SIQ data import
/*
export interface ImportLogDto {
  id: string;
  fileName: string;
  importDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  rowsProcessed: number | null;
  rowsCreated: number | null;
  rowsUpdated: number | null;
  rowsFailed: number | null;
  errorLog: string | null;
  createdAt: string;
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
  itemsSkipped: number;
  inventorySnapshotsCreated: number;
  inventorySnapshotsSkipped: number;
  salesActualsCreated: number;
  salesActualsUpdated: number;
  salesActualsSkipped: number;
  forecastsCreated: number;
  forecastsUpdated: number;
  forecastsSkipped: number;
  customerMetricsCreated: number;
  customerMetricsSkipped: number;
}

export interface ImportResultDto {
  importId: string;
  status: "COMPLETED" | "FAILED";
  stats: ImportStatsDto;
  errors?: string[];
  completedAt: string;
}

export interface SiteDto { ... }
export interface SupplierDto { ... }
export interface ItemDto { ... }
export interface InventorySnapshotDto { ... }
export interface SalesActualDto { ... }
export interface ForecastDto { ... }
export interface CustomerMetricDto { ... }
*/

export {};
