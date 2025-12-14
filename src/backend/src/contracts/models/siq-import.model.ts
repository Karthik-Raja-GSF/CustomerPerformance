import { ImportStatus, Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;

/**
 * SIQ Import Models - Internal models matching Prisma schema
 */

export interface SiteModel {
  id: string;
  code: string;
  company: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierModel {
  id: string;
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemModel {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface InventorySnapshotModel {
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
  weeksSupply: Decimal | null;
  nextPoDate: Date | null;
  nextPoQty: number | null;
  snapshotDate: Date;
  createdAt: Date;
}

export interface SalesActualModel {
  id: string;
  itemId: string;
  siteId: string;
  periodType: string;
  periodLabel: string;
  periodDate: Date;
  quantity: number;
  createdAt: Date;
}

export interface ForecastModel {
  id: string;
  itemId: string;
  siteId: string;
  forecastMonth: Date;
  predictedQty: number;
  variancePct: Decimal | null;
  supplyVariance: number | null;
  createdAt: Date;
}

export interface CustomerMetricModel {
  id: string;
  itemId: string;
  totalCustomers: number | null;
  topCustomers: string | null;
  buyer: string | null;
  snapshotDate: Date;
  createdAt: Date;
}

export interface ImportLogModel {
  id: string;
  fileName: string;
  importDate: Date;
  status: ImportStatus;
  rowsProcessed: number | null;
  rowsCreated: number | null;
  rowsUpdated: number | null;
  rowsFailed: number | null;
  errorLog: string | null;
  createdAt: Date;
  completedAt: Date | null;
}
