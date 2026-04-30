import { useMemo, useState } from "react";
import {
  Download,
  Filter,
  Package,
  Truck,
  Target,
  BarChart2,
  TrendingUp,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from "recharts";
import type {
  ValueType,
  NameType,
} from "recharts/types/component/DefaultTooltipContent";
import {
  getCustomerDetailRows,
  getChurnRiskRows,
  computeKpis,
  LOCATIONS,
  MONTHLY_PERFORMANCE,
} from "@/apis/customer-performance";
import type {
  CustomerDetailRow,
  ChurnRiskRow,
  RiskLevel,
  OrderTrend,
} from "@/types/customer-performance";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/shadcn/components/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select";
import { Input } from "@/shadcn/components/input";
import { Button } from "@/shadcn/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";
import { cn } from "@/shadcn/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function exportCsv(rows: CustomerDetailRow[]) {
  const headers = [
    "Location",
    "Co-Op",
    "Bill To Customer",
    "Customer #",
    "Item #",
    "Description",
    "Brand",
    "Pack",
    "Vendor Name",
    "Bid Qty",
    "YTD Usage",
    "Vendor Fill %",
    "Conversion %",
    "Avg Lead Time (days)",
  ];
  const lines = rows.map((r) =>
    [
      r.location,
      r.coOp,
      r.billToCustomerName,
      r.billToCustomerNo,
      r.itemNo,
      `"${r.description}"`,
      r.brand,
      r.pack,
      r.vendorName,
      r.bidQty,
      r.ytdUsage,
      r.vendorItemFillPct,
      r.conversionPct,
      r.avgLeadTime,
    ].join(",")
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer-performance.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

const METRICS = [
  {
    key: "totalQtyOrdered",
    label: "Total Qty Ordered",
    icon: Package,
    color: "#F59E0B",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "totalQtyShipped",
    label: "Total Qty Shipped",
    icon: Truck,
    color: "#3B82F6",
    format: (v: number) => v.toLocaleString(),
  },
  {
    key: "serviceRate",
    label: "Service Rate",
    icon: Target,
    color: "#10B981",
    format: (v: number) => `${v}%`,
  },
  {
    key: "fillRate",
    label: "Fill Rate",
    icon: BarChart2,
    color: "#8B5CF6",
    format: (v: number) => `${v}%`,
  },
  {
    key: "conversionPct",
    label: "Conversion %",
    icon: TrendingUp,
    color: "#F97316",
    format: (v: number) => `${v}%`,
    subtitle: "Bid vs Actuals",
  },
  {
    key: "orderToShipVariance",
    label: "Order To Ship Variance",
    icon: ArrowRightLeft,
    color: "#EF4444",
    format: (v: number) => fmt$(v),
    subtitleKey: "orderToShipVarianceCs" as const,
  },
  {
    key: "avgLeadTime",
    label: "Avg Order Lead Time",
    icon: Clock,
    color: "#6366F1",
    format: (v: number) => `${v} days`,
  },
] as const;

type _KpiKey = (typeof METRICS)[number]["key"];

function MetricCard({
  label,
  icon: Icon,
  color,
  value,
  subtitle,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div
      className="flex-1 min-w-[140px] rounded-lg border bg-card px-4 py-3 flex flex-col gap-1"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="text-xs leading-tight">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ─── Tooltips ────────────────────────────────────────────────────────────────

function QtyTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? "#888" }}>
          {p.name}:{" "}
          <span className="font-semibold">
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Risk / Trend badges ──────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};

const TREND_STYLES: Record<OrderTrend, string> = {
  Declining: "text-red-600",
  Stable: "text-amber-600",
  Growing: "text-green-600",
};

// ─── Tab: YTD Performance ────────────────────────────────────────────────────

function YtdPerformanceTab({ rows }: { rows: CustomerDetailRow[] }) {
  const byLocation = useMemo(() => {
    const map: Record<string, { qtyOrdered: number; qtyShipped: number }> = {};
    for (const r of rows) {
      if (!map[r.location]) map[r.location] = { qtyOrdered: 0, qtyShipped: 0 };
      map[r.location]!.qtyOrdered += r.bidQty;
      map[r.location]!.qtyShipped += r.ytdUsage;
    }
    return Object.entries(map).map(([location, v]) => ({ location, ...v }));
  }, [rows]);

  const vendorImpactData = useMemo(() => {
    const map: Record<string, { totalShortage: number; count: number }> = {};

    rows.forEach((r) => {
      const name = r.vendorName || "Unknown";
      if (!map[name]) map[name] = { totalShortage: 0, count: 0 };
      // Assuming (100 - fillRate) represents the "Shortage Impact"
      map[name].totalShortage += 100 - r.vendorItemFillPct;
      map[name].count += 1;
    });

    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        shortageImpact: parseFloat((v.totalShortage / v.count).toFixed(1)),
      }))
      .sort((a, b) => b.shortageImpact - a.shortageImpact) // Sort descending like the image
      .slice(0, 6); // Top 6 vendors to keep it clean
  }, [rows]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* Line chart — full width */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold mb-3">
          Performance Trend: Ordered vs Shipped vs Estimates
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart
            data={MONTHLY_PERFORMANCE}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}K`}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<QtyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="qtyOrdered"
              name="Ordered"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ r: 4, fill: "#F59E0B" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="qtyShipped"
              name="Shipped"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3B82F6" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="estimates"
              name="Estimates"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={{ r: 4, fill: "#8B5CF6" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bar charts row */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold mb-3">
            Monthly Qty Ordered vs Shipped
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={MONTHLY_PERFORMANCE}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}K`}
                tick={{ fontSize: 10 }}
              />
              <Tooltip content={<QtyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="qtyOrdered"
                name="Qty Ordered"
                fill="#3B82F6"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="qtyShipped"
                name="Qty Shipped"
                fill="#10B981"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold mb-3">
            Vendor Impact on Business
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={vendorImpactData}
              margin={{ top: 10, right: 10, left: -20, bottom: 60 }} // Extra bottom margin for rotated labels
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                verticalFill={["#f5f5f5"]}
                fillOpacity={0.4}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#666" }}
                interval={0}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                label={{
                  value: "Shortage Impact %",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: { fontSize: "11px", fill: "#666" },
                }}
                tick={{ fontSize: 10 }}
                domain={[0, 20]}
              />
              <Tooltip content={<QtyTooltip />} />
              <Bar
                dataKey="shortageImpact"
                name="Shortage Impact %"
                fill="#ef4444" // The red color from your image
                radius={[4, 4, 0, 0]}
                barSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-semibold mb-3">
            Qty Ordered vs Shipped by Location
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={byLocation}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="location" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<QtyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="qtyOrdered"
                name="Qty Ordered"
                fill="#3B82F6"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="qtyShipped"
                name="Qty Shipped"
                fill="#10B981"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Churn Risk ─────────────────────────────────────────────────────────

type ChurnRiskTabProps = { locationFilter: string };
function ChurnRiskTab({ locationFilter }: ChurnRiskTabProps) {
  const rows = useMemo(() => {
    const all = getChurnRiskRows();
    return locationFilter
      ? all.filter((r) => r.location === locationFilter)
      : all;
  }, [locationFilter]);

  return (
    <div className="pt-4 rounded-md border overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Customer</TableHead>
            <TableHead className="text-xs">Customer #</TableHead>
            <TableHead className="text-xs">Location</TableHead>
            <TableHead className="text-xs">Co-Op</TableHead>
            <TableHead className="text-xs">Last Order</TableHead>
            <TableHead className="text-xs">YTD Qty</TableHead>
            <TableHead className="text-xs">Prior YTD</TableHead>
            <TableHead className="text-xs">Trend</TableHead>
            <TableHead className="text-xs">Fill Rate</TableHead>
            <TableHead className="text-xs">Risk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={10}
                className="text-center text-muted-foreground py-8 text-sm"
              >
                No churn risk records for this location.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r: ChurnRiskRow) => (
              <TableRow key={r.customerNo}>
                <TableCell className="text-sm font-medium">
                  {r.customerName}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.customerNo}
                </TableCell>
                <TableCell>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                    {r.location}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{r.coOp}</TableCell>
                <TableCell className="text-sm">{r.lastOrderDate}</TableCell>
                <TableCell className="text-sm tabular-nums">
                  {r.ytdQtyOrdered.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {r.priorYtdQtyOrdered.toLocaleString()}
                </TableCell>
                <TableCell
                  className={cn("text-sm font-medium", TREND_STYLES[r.trend])}
                >
                  {r.trend}
                </TableCell>
                <TableCell className="text-sm">{r.fillRateAvg}%</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-xs rounded-full px-2 py-0.5 font-medium",
                      RISK_STYLES[r.riskLevel]
                    )}
                  >
                    {r.riskLevel}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tab: Customer Details ────────────────────────────────────────────────────

const DETAIL_HEADERS = [
  { label: "Location" },
  { label: "Co Op (commercial)" },
  { label: "Bill To Customer Name" },
  { label: "Bill to Customer #" },
  { label: "Item #" },
  { label: "Description" },
  { label: "Brand" },
  { label: "Pack" },
  { label: "Vendor Name" },
  { label: "Vendor Lead Time", right: true },
  { label: "Vendor Min Qty", right: true },
  { label: "Vendor Order Freq" },
  { label: "ERP Status" },
  { label: "On Hand", right: true },
  { label: "On Purch Order", right: true },
  { label: "Cust Sales Order", right: true },
  { label: "LY Usage", right: true },
  { label: "Bid Qty", right: true },
  { label: "YTD Usage", right: true },
  { label: "Conversion %", right: true },
  { label: "Non Bid Item" },
  { label: "Avg Lead Time", right: true },
  { label: "Cust Order Freq (30d)", right: true },
  { label: "Unique Customers", right: true },
  { label: "Monthly Forecast", right: true },
  { label: "Safety Stock", right: true },
  { label: "Monthly Estimates", right: true },
  { label: "Monthly Actual", right: true },
  { label: "% Consumed", right: true },
  { label: "Vendor Item Fill %", right: true },
];

const ERP_STYLES: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Inactive: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
};

function PctCell({ value }: { value: number }) {
  const cls =
    value >= 95
      ? "text-green-600"
      : value >= 90
        ? "text-amber-500"
        : "text-red-500";
  return <span className={cn("font-medium", cls)}>{value}%</span>;
}

function CustomerDetailsTab({ rows }: { rows: CustomerDetailRow[] }) {
  return (
    <div className="pt-4">
      <p className="text-sm font-semibold mb-3">Customer Performance Details</p>
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {DETAIL_HEADERS.map((h) => (
                <TableHead
                  key={h.label}
                  className={cn(
                    "text-xs whitespace-nowrap",
                    h.right && "text-right"
                  )}
                >
                  {h.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={DETAIL_HEADERS.length}
                  className="text-center text-muted-foreground py-8 text-sm"
                >
                  No records match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {r.location}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{r.coOp}</TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">
                    {r.billToCustomerName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.billToCustomerNo}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.itemNo}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.description}
                  </TableCell>
                  <TableCell className="text-sm">{r.brand}</TableCell>
                  <TableCell className="text-sm">{r.pack}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {r.vendorName}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.vendorLeadTime}d
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.vendorMinQty.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.vendorOrderFrequency}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "text-xs rounded-full px-2 py-0.5 font-medium",
                        ERP_STYLES[r.erpStatus] ?? ""
                      )}
                    >
                      {r.erpStatus}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.onHand.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.onPurchOrder.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.custSalesOrder.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.lyUsage.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.bidQty.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.ytdUsage.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    <PctCell value={r.conversionPct} />
                  </TableCell>
                  <TableCell className="text-sm text-center">
                    {r.nonBidItemFlag ? "Yes" : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.avgLeadTime}d
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.custOrderFreqLast30}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.uniqueCustomerCount}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.monthlyForecast.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.safetyStock.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.monthlyEstimates.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums">
                    {r.monthlyActual.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    <PctCell value={r.pctConsumed} />
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    <PctCell value={r.vendorItemFillPct} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerPerformance() {
  const allRows = useMemo(() => getCustomerDetailRows(), []);
  const [locationFilter, setLocationFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [search, setSearch] = useState("");

  const customerNames = useMemo(() => {
    const filtered = locationFilter
      ? allRows.filter((r) => r.location === locationFilter)
      : allRows;
    return [...new Set(filtered.map((r) => r.billToCustomerName))].sort();
  }, [allRows, locationFilter]);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (locationFilter && r.location !== locationFilter) return false;
      if (customerFilter && r.billToCustomerName !== customerFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.billToCustomerName.toLowerCase().includes(q) &&
          !r.itemNo.toLowerCase().includes(q) &&
          !r.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [allRows, locationFilter, customerFilter, search]);

  const kpi: Record<KpiKey, number> = useMemo(
    () => computeKpis(filteredRows),
    [filteredRows]
  );

  function handleLocationChange(val: string) {
    setLocationFilter(val === "__all__" ? "" : val);
    setCustomerFilter("");
  }

  function handleCustomerChange(val: string) {
    setCustomerFilter(val === "__all__" ? "" : val);
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Customer Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track YTD performance, churn risk, and customer metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(filteredRows)}
        >
          <Download className="size-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
          <Filter className="size-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Location
            </label>
            <Select
              value={locationFilter || "__all__"}
              onValueChange={handleLocationChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Locations</SelectItem>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Customer
            </label>
            <Select
              value={customerFilter || "__all__"}
              onValueChange={handleCustomerChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Customers</SelectItem>
                {customerNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input
              placeholder="Search by customer, SKU, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="flex flex-wrap gap-3 overflow-x-auto pb-1 min-h-[80px]">
        {METRICS.map((m) => {
          const val = kpi[m.key as KpiKey] as number;
          const subtitle =
            "subtitleKey" in m
              ? `+${kpi[m.subtitleKey].toLocaleString()} CS`
              : "subtitle" in m
                ? m.subtitle
                : undefined;
          return (
            <MetricCard
              key={m.key}
              label={m.label}
              icon={m.icon}
              color={m.color}
              value={m.format(val)}
              subtitle={subtitle}
            />
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="ytd">YTD Performance</TabsTrigger>
          <TabsTrigger value="churn">Churn Risk</TabsTrigger>
          <TabsTrigger value="details">Customer Details</TabsTrigger>
        </TabsList>

        <TabsContent value="ytd">
          <YtdPerformanceTab rows={filteredRows} />
        </TabsContent>

        <TabsContent value="churn">
          <ChurnRiskTab locationFilter={locationFilter} />
        </TabsContent>

        <TabsContent value="details">
          <CustomerDetailsTab rows={filteredRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
