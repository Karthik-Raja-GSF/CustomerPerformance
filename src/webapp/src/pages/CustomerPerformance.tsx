import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
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
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  getCustomerDetailRows,
  getLostSalesReasons,
  computeKpis,
  LOCATIONS,
  MONTHLY_PERFORMANCE,
} from "@/apis/customer-performance";
import type {
  CustomerDetailRow,
  LostSalesReason,
  ErpStatus,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/components/popover";
import { Checkbox } from "@/shadcn/components/checkbox";
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

const ALL_MONTHS = MONTHLY_PERFORMANCE.map((m) => m.month);

function exportCsv(rows: CustomerDetailRow[]) {
  const headers = [
    "Month",
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
      r.month,
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
    label: "Total Bid Qty",
    color: "#F59E0B",
    format: (v: number) => v.toLocaleString(),
    subtitle: "Expected quantity",
  },
  {
    key: "totalQtyShipped",
    label: "Actuals YTD",
    color: "#3B82F6",
    format: (v: number) => v.toLocaleString(),
    subtitle: "Delivered quantity",
  },
  {
    key: "conversionPct",
    label: "Conversion %",
    color: "#10B981",
    format: (v: number) => `${v}%`,
    showProgress: true,
    showVariance: true,
  },
  {
    key: "serviceRate",
    label: "Service Rate",
    color: "#10B981",
    format: (v: number) => `${v}%`,
    subtitle: "Order fulfillment",
    showProgress: true,
  },
  {
    key: "fillRate",
    label: "Fill Rate",
    color: "#8B5CF6",
    format: (v: number) => `${v}%`,
    subtitle: "Vendor fill rate",
    showProgress: true,
  },
  {
    key: "orderToShipVariance",
    label: "Order / Ship Variance",
    color: "#EF4444",
    format: (v: number) => v.toLocaleString(),
    subtitleKey: "orderToShipVarianceCs" as const,
  },
  {
    key: "avgLeadTime",
    label: "Avg Lead Time",
    color: "#6366F1",
    format: (v: number) => `${v} days`,
    subtitle: "Days to ship",
  },
] as const;

type KpiKey = (typeof METRICS)[number]["key"];

function MetricCard({
  label,
  color,
  value,
  subtitle,
  progress,
  variance,
}: {
  label: string;
  color: string;
  value: string;
  subtitle?: string;
  progress?: number;
  variance?: number;
}) {
  return (
    <div
      className="flex-1 rounded-xl border bg-card px-5 py-4 flex flex-col gap-1.5"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold leading-tight" style={{ color }}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progress, 100)}%`,
              backgroundColor: color,
            }}
          />
        </div>
      )}
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      {variance !== undefined && (
        <p
          className="text-xs font-medium"
          style={{ color: variance < 0 ? "#EF4444" : "#10B981" }}
        >
          Variance: {variance > 0 ? "+" : ""}
          {variance.toLocaleString()}
        </p>
      )}
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

// ─── Lost Sales by Reason ─────────────────────────────────────────────────────

function LostSalesByReason({ data }: { data: LostSalesReason[] }) {
  const maxPct = Math.max(...data.map((d) => d.pct));
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-4">
      <p className="text-sm font-semibold">Lost Sales by Reason</p>
      {data.map((item) => (
        <div key={item.reason} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">{item.reason}</span>
            <span className="text-xs text-muted-foreground">
              ({item.instances} instances)
            </span>
          </div>
          <p className="text-2xl font-bold text-red-500">{item.pct}%</p>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 transition-all"
              style={{ width: `${(item.pct / maxPct) * 100}%` }}
            />
          </div>
          <div className="flex flex-col gap-1 mt-0.5">
            {item.vendors.map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between rounded bg-muted/60 px-2 py-1"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {v.name}
                </span>
                <span className="text-xs font-semibold text-red-500">
                  {v.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Filter Helpers ────────────────────────────────────────────────────

function useLocationCustomerFilter(allRows: CustomerDetailRow[]) {
  const [locationFilter, setLocationFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const customerNames = useMemo(() => {
    const filtered = locationFilter
      ? allRows.filter((r) => r.location === locationFilter)
      : allRows;
    return [...new Set(filtered.map((r) => r.billToCustomerName))].sort();
  }, [allRows, locationFilter]);

  function handleLocationChange(val: string) {
    setLocationFilter(val === "__all__" ? "" : val);
    setCustomerFilter("");
  }

  function handleCustomerChange(val: string) {
    setCustomerFilter(val === "__all__" ? "" : val);
  }

  return {
    locationFilter,
    customerFilter,
    customerNames,
    handleLocationChange,
    handleCustomerChange,
  };
}

// ─── Month Multi-Select ───────────────────────────────────────────────────────

function MonthMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (months: string[]) => void;
}) {
  function toggle(month: string) {
    if (selected.includes(month)) {
      onChange(selected.filter((m) => m !== month));
    } else {
      onChange([...selected, month]);
    }
  }

  const label =
    selected.length === 0
      ? "All Months"
      : selected.length === ALL_MONTHS.length
        ? "All Months"
        : selected.join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 w-full justify-between font-normal text-sm"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {ALL_MONTHS.map((month) => {
          const checked = selected.includes(month);
          return (
            <div
              key={month}
              className="flex items-center gap-2.5 rounded px-2 py-1.5 cursor-pointer hover:bg-muted"
              onClick={() => toggle(month)}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(month)}
                className="pointer-events-none"
              />
              <span className="text-sm">{month}</span>
              {checked && <Check className="size-3.5 ml-auto text-primary" />}
            </div>
          );
        })}
        {selected.length > 0 && (
          <div
            className="mt-1 rounded px-2 py-1.5 text-xs text-muted-foreground cursor-pointer hover:bg-muted border-t"
            onClick={() => onChange([])}
          >
            Clear selection
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Tab: YTD Performance ────────────────────────────────────────────────────

function YtdPerformanceTab({ allRows }: { allRows: CustomerDetailRow[] }) {
  const {
    locationFilter,
    customerFilter,
    customerNames,
    handleLocationChange,
    handleCustomerChange,
  } = useLocationCustomerFilter(allRows);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (locationFilter && r.location !== locationFilter) return false;
      if (customerFilter && r.billToCustomerName !== customerFilter)
        return false;
      return true;
    });
  }, [allRows, locationFilter, customerFilter]);

  const kpi = useMemo(() => computeKpis(filteredRows), [filteredRows]);

  const lostSales = useMemo(() => getLostSalesReasons(), []);

  const byLocation = useMemo(() => {
    const map: Record<string, { qtyOrdered: number; qtyShipped: number }> = {};
    for (const r of filteredRows) {
      if (!map[r.location]) map[r.location] = { qtyOrdered: 0, qtyShipped: 0 };
      map[r.location]!.qtyOrdered += r.bidQty;
      map[r.location]!.qtyShipped += r.ytdUsage;
    }
    return Object.entries(map).map(([location, v]) => ({ location, ...v }));
  }, [filteredRows]);

  const forecastAccuracy = useMemo(() => {
    return MONTHLY_PERFORMANCE.map((m) => ({
      month: m.month,
      estimates: m.estimates,
      actual: m.qtyShipped,
      accuracy: Math.round((m.qtyShipped / m.estimates) * 1000) / 10,
    }));
  }, []);

  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filteredRows) {
      map[r.billToCustomerName] = (map[r.billToCustomerName] ?? 0) + r.ytdUsage;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, ytdUsage]) => ({ name, ytdUsage }));
  }, [filteredRows]);

  function renderCard(m: (typeof METRICS)[number]) {
    const val = kpi[m.key];
    const progress = "showProgress" in m && m.showProgress ? val : undefined;
    const variance =
      "showVariance" in m && m.showVariance
        ? kpi["totalQtyShipped" as KpiKey] - kpi["totalQtyOrdered" as KpiKey]
        : undefined;
    const subtitle =
      "subtitleKey" in m
        ? `${kpi[m.subtitleKey].toLocaleString()} CS gap`
        : "subtitle" in m
          ? m.subtitle
          : undefined;
    return (
      <MetricCard
        key={m.key}
        label={m.label}
        color={m.color}
        value={m.format(val)}
        subtitle={subtitle}
        progress={progress}
        variance={variance}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
          <Filter className="size-4" />
          <span className="text-sm font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="flex flex-col gap-3 flex-shrink-0 h-[290px] overflow-hidden px-1 py-2">
        <div className="flex gap-4 flex-1">
          {METRICS.slice(0, 3).map(renderCard)}
        </div>
        <div className="flex gap-4 flex-1">
          {METRICS.slice(3).map(renderCard)}
        </div>
      </div>

      {/* Line chart — full width */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold mb-3">
          Performance Trend: Ordered vs Shipped vs Estimates
        </p>
        <ResponsiveContainer width="100%" height={250}>
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

      {/* Middle row: charts (left 2/3) + Lost Sales panel (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold mb-3">
              Monthly Qty Ordered vs Shipped
            </p>
            <ResponsiveContainer width="100%" height={210}>
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
              Forecast Accuracy (Estimates vs Actual)
            </p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart
                data={forecastAccuracy}
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
                  dataKey="estimates"
                  name="Estimates"
                  fill="#8B5CF6"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="actual"
                  name="Actual Shipped"
                  fill="#10B981"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold mb-3">
              Top Customers by YTD Usage
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                layout="vertical"
                data={topCustomers}
                margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${((v as number) / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  width={140}
                />
                <Tooltip content={<QtyTooltip />} />
                <Bar
                  dataKey="ytdUsage"
                  name="YTD Usage"
                  fill="#F59E0B"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <LostSalesByReason data={lostSales} />
      </div>

      {/* Location bar — full width */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold mb-3">
          Qty Ordered vs Shipped by Location
        </p>
        <ResponsiveContainer width="100%" height={210}>
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
  );
}

// ─── Tab: Customer Details ────────────────────────────────────────────────────

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

const DETAIL_COLUMNS: ColumnDef<CustomerDetailRow>[] = [
  {
    accessorKey: "month",
    header: "Month",
    cell: ({ getValue }) => (
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ getValue }) => (
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
        {getValue() as string}
      </span>
    ),
  },
  { accessorKey: "coOp", header: "Co Op" },
  {
    accessorKey: "billToCustomerName",
    header: "Bill To Customer Name",
    cell: ({ getValue }) => (
      <span className="text-sm font-medium whitespace-nowrap">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "billToCustomerNo",
    header: "Bill To Customer #",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "itemNo",
    header: "Item #",
    cell: ({ getValue }) => (
      <span className="text-sm text-muted-foreground">
        {getValue() as string}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ getValue }) => (
      <span className="text-sm whitespace-nowrap">{getValue() as string}</span>
    ),
  },
  { accessorKey: "brand", header: "Brand" },
  { accessorKey: "pack", header: "Pack" },
  {
    accessorKey: "vendorName",
    header: "Vendor Name",
    cell: ({ getValue }) => (
      <span className="text-sm whitespace-nowrap">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "vendorLeadTime",
    header: "Vendor Lead Time",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">{getValue() as number}d</span>
    ),
  },
  {
    accessorKey: "vendorMinQty",
    header: "Vendor Min Qty",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  { accessorKey: "vendorOrderFrequency", header: "Vendor Order Freq" },
  {
    accessorKey: "erpStatus",
    header: "ERP Status",
    cell: ({ getValue }) => {
      const v = getValue() as ErpStatus;
      return (
        <span
          className={cn(
            "text-xs rounded-full px-2 py-0.5 font-medium",
            ERP_STYLES[v] ?? ""
          )}
        >
          {v}
        </span>
      );
    },
  },
  {
    accessorKey: "onHand",
    header: "On Hand",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "onPurchOrder",
    header: "On Purch Order",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "custSalesOrder",
    header: "Cust Sales Order",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "lyUsage",
    header: "LY Usage",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "bidQty",
    header: "Bid Qty",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "ytdUsage",
    header: "YTD Usage",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "conversionPct",
    header: "Conversion %",
    cell: ({ getValue }) => <PctCell value={getValue() as number} />,
  },
  {
    accessorKey: "nonBidItemFlag",
    header: "Non Bid Item",
    cell: ({ getValue }) => (
      <span className="text-sm">{getValue() ? "Yes" : "—"}</span>
    ),
  },
  {
    accessorKey: "avgLeadTime",
    header: "Avg Lead Time",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">{getValue() as number}d</span>
    ),
  },
  {
    accessorKey: "custOrderFreqLast30",
    header: "Cust Order Freq (30d)",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: "uniqueCustomerCount",
    header: "Unique Customers",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: "monthlyForecast",
    header: "Monthly Forecast",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "safetyStock",
    header: "Safety Stock",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "monthlyEstimates",
    header: "Monthly Estimates",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "monthlyActual",
    header: "Monthly Actual",
    cell: ({ getValue }) => (
      <span className="text-sm tabular-nums">
        {(getValue() as number).toLocaleString()}
      </span>
    ),
  },
  {
    accessorKey: "pctConsumed",
    header: "% Consumed",
    cell: ({ getValue }) => <PctCell value={getValue() as number} />,
  },
  {
    accessorKey: "vendorItemFillPct",
    header: "Vendor Item Fill %",
    cell: ({ getValue }) => <PctCell value={getValue() as number} />,
  },
];

function CustomerDetailsTab({ allRows }: { allRows: CustomerDetailRow[] }) {
  const {
    locationFilter,
    customerFilter,
    customerNames,
    handleLocationChange,
    handleCustomerChange,
  } = useLocationCustomerFilter(allRows);
  const [search, setSearch] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (locationFilter && r.location !== locationFilter) return false;
      if (customerFilter && r.billToCustomerName !== customerFilter)
        return false;
      if (selectedMonths.length > 0 && !selectedMonths.includes(r.month))
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
  }, [allRows, locationFilter, customerFilter, selectedMonths, search]);

  useEffect(() => {
    setPageIndex(0);
  }, [filteredRows]);

  const table = useReactTable({
    data: filteredRows,
    columns: DETAIL_COLUMNS,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex, pageSize })
          : updater;
      setPageIndex(next.pageIndex);
      setPageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, filteredRows.length);

  return (
    <div className="flex flex-col gap-4 pt-4">
      {/* Filters + Export */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="size-4" />
            <span className="text-sm font-medium">Filters</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Month
            </label>
            <MonthMultiSelect
              selected={selectedMonths}
              onChange={setSelectedMonths}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Search
            </label>
            <Input
              placeholder="Customer, SKU, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {table.getFlatHeaders().map((header) => (
                <TableHead
                  key={header.id}
                  className="text-xs whitespace-nowrap cursor-pointer select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {header.column.getIsSorted() === "asc"
                    ? " ↑"
                    : header.column.getIsSorted() === "desc"
                      ? " ↓"
                      : ""}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={DETAIL_COLUMNS.length}
                  className="text-center text-muted-foreground py-8 text-sm"
                >
                  No records match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-sm">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Rows per page
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPageIndex(0);
            }}
          >
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span className="text-xs text-muted-foreground">
          {filteredRows.length === 0 ? "0" : `${start}–${end}`} of{" "}
          {filteredRows.length}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageIndex((p) => p - 1)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="text-xs px-2">
            Page {filteredRows.length === 0 ? 0 : pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageIndex((p) => p + 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerPerformance() {
  const allRows = useMemo(() => getCustomerDetailRows(), []);

  return (
    <div className="flex flex-col gap-4 p-6 overflow-auto">
      <div>
        <h1 className="text-xl font-semibold">Customer Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track YTD performance and detailed customer metrics
        </p>
      </div>

      <Tabs defaultValue="ytd">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="ytd">YTD Performance</TabsTrigger>
          <TabsTrigger value="details">Customer Details</TabsTrigger>
        </TabsList>

        <TabsContent value="ytd">
          <YtdPerformanceTab allRows={allRows} />
        </TabsContent>

        <TabsContent value="details">
          <CustomerDetailsTab allRows={allRows} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
