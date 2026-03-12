import { useMemo } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { Package, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shadcn/components/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/shadcn/components/chart";
import type { CustomerBidStatsDto } from "@/types/customer-bids";

const COLORS = [
  "oklch(0.65 0.20 250)",
  "oklch(0.65 0.20 150)",
  "oklch(0.65 0.20 30)",
  "oklch(0.65 0.20 320)",
  "oklch(0.65 0.20 190)",
  "oklch(0.65 0.20 80)",
  "oklch(0.65 0.20 280)",
  "oklch(0.65 0.20 110)",
];

/** Grey placeholder for locations with 0 confirmations */
const MUTED_FILL = "oklch(0.80 0.01 250)";

interface StatsCardsProps {
  stats: CustomerBidStatsDto | null;
}

interface LocationDisplay {
  siteCode: string;
  total: number;
  confirmed: number;
  percent: number;
  fill: string;
}

/** Slice entry for the pie chart (locations with confirmed > 0 + grey remainder) */
interface PieSlice {
  siteCode: string;
  sliceValue: number;
  fill: string;
  confirmed: number;
  total: number;
  percent: number;
}

/** Format percentage with meaningful precision */
function formatPercent(value: number): string {
  if (value === 0) return "0%";
  if (value >= 1) return `${value.toFixed(1)}%`;
  // Small values: show enough decimals to be non-zero
  return `${value.toFixed(2)}%`;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { confirmedPercent, locations, pieData, chartConfig } = useMemo(() => {
    if (!stats || stats.totalItems === 0) {
      return {
        confirmedPercent: 0,
        locations: [],
        pieData: [],
        chartConfig: {},
      };
    }

    const percent = (stats.confirmedItems / stats.totalItems) * 100;

    const locs: LocationDisplay[] = stats.byLocation.map((loc, i) => ({
      siteCode: loc.siteCode,
      total: loc.total,
      confirmed: loc.confirmed,
      percent: loc.total > 0 ? (loc.confirmed / loc.total) * 100 : 0,
      fill:
        loc.confirmed > 0 ? (COLORS[i % COLORS.length] as string) : MUTED_FILL,
    }));

    // Pie slices: colored wedge per location with confirmations + grey remainder
    const slices: PieSlice[] = locs
      .filter((loc) => loc.confirmed > 0)
      .map((loc) => ({
        siteCode: loc.siteCode,
        sliceValue: loc.confirmed,
        fill: loc.fill,
        confirmed: loc.confirmed,
        total: loc.total,
        percent: loc.percent,
      }));

    const unconfirmedCount = stats.totalItems - stats.confirmedItems;
    if (unconfirmedCount > 0) {
      slices.push({
        siteCode: "Unconfirmed",
        sliceValue: unconfirmedCount,
        fill: MUTED_FILL,
        confirmed: 0,
        total: unconfirmedCount,
        percent: 0,
      });
    }

    const config: ChartConfig = {};
    for (const loc of locs) {
      config[loc.siteCode] = {
        label: loc.siteCode,
        color: loc.fill,
      };
    }

    return {
      confirmedPercent: percent,
      locations: locs,
      pieData: slices,
      chartConfig: config,
    };
  }, [stats]);

  if (!stats || stats.totalItems === 0) return null;

  return (
    <div className="shrink-0 grid grid-cols-3 gap-3">
      {/* Total Items */}
      <Card className="py-2 gap-1">
        <CardHeader className="pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3 w-3" />
            Total Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tabular-nums">
            {stats.totalItems.toLocaleString()}
          </div>
        </CardContent>
      </Card>

      {/* Confirmed by Sales */}
      <Card className="py-2 gap-1">
        <CardHeader className="pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed by Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold tabular-nums">
            {confirmedPercent.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.confirmedItems.toLocaleString()} of{" "}
            {stats.totalItems.toLocaleString()} items
          </p>
        </CardContent>
      </Card>

      {/* Confirmed by Location (Donut Chart) */}
      <Card className="py-2 gap-1">
        <CardHeader className="pb-0">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Confirmed by Location
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <ChartContainer
            config={chartConfig}
            className="h-[80px] w-[80px] shrink-0"
          >
            <PieChart>
              <ChartTooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const data = payload[0]?.payload as PieSlice | undefined;
                  if (!data || data.siteCode === "Unconfirmed") return null;
                  return (
                    <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
                      <p className="font-medium">{data.siteCode}</p>
                      <p className="text-muted-foreground">
                        {data.confirmed}/{data.total} confirmed (
                        {formatPercent(data.percent)})
                      </p>
                    </div>
                  );
                }}
              />
              <Pie
                data={pieData}
                dataKey="sliceValue"
                nameKey="siteCode"
                outerRadius={35}
                strokeWidth={2}
                stroke="var(--background)"
              >
                {pieData.map((entry) => (
                  <Cell key={entry.siteCode} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs min-w-0 max-h-[80px] overflow-y-auto">
            {locations.map((loc) => (
              <div key={loc.siteCode} className="flex items-center gap-1">
                <div
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: loc.fill }}
                />
                <span className="font-medium">{loc.siteCode}</span>
                <span className="text-muted-foreground tabular-nums">
                  {formatPercent(loc.percent)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
