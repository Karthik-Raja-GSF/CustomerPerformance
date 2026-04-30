export type CoOpType = "Commercial" | "Co-Op";
export type RiskLevel = "High" | "Medium" | "Low";
export type OrderTrend = "Declining" | "Stable" | "Growing";
export type ErpStatus = "Active" | "Inactive" | "Pending";

export type CustomerPerformanceKpi = {
  totalQtyOrdered: number;
  totalQtyShipped: number;
  serviceRate: number;
  fillRate: number;
  conversionPct: number;
  orderToShipVariance: number;
  orderToShipVarianceCs: number;
  avgLeadTime: number;
};

export type CustomerDetailRow = {
  id: string;
  month: string;
  // Identity
  location: string;
  coOp: CoOpType;
  billToCustomerName: string;
  billToCustomerNo: string;
  itemNo: string;
  description: string;
  brand: string;
  pack: string;
  // Vendor
  vendorName: string;
  vendorLeadTime: number; // days
  vendorMinQty: number;
  vendorOrderFrequency: string; // e.g. "Weekly"
  // Inventory / ordering
  erpStatus: ErpStatus;
  onHand: number;
  onPurchOrder: number;
  custSalesOrder: number;
  // Demand
  lyUsage: number;
  bidQty: number;
  ytdUsage: number;
  conversionPct: number;
  nonBidItemFlag: boolean;
  avgLeadTime: number; // days
  custOrderFreqLast30: number; // # of orders in last 30 days
  uniqueCustomerCount: number;
  // Forecast / actuals
  monthlyForecast: number;
  safetyStock: number;
  monthlyEstimates: number;
  monthlyActual: number;
  pctConsumed: number; // %
  vendorItemFillPct: number; // %
};

export type ChurnRiskRow = {
  customerNo: string;
  customerName: string;
  location: string;
  coOp: CoOpType;
  lastOrderDate: string;
  ytdQtyOrdered: number;
  priorYtdQtyOrdered: number;
  trend: OrderTrend;
  fillRateAvg: number;
  riskLevel: RiskLevel;
};

export type LostSalesVendor = {
  name: string;
  pct: number;
};

export type LostSalesReason = {
  reason: string;
  instances: number;
  pct: number;
  vendors: LostSalesVendor[];
};

export type MonthlyPerformance = {
  month: string;
  qtyOrdered: number;
  qtyShipped: number;
  estimates: number;
  serviceRate: number;
};
