import type { ColumnDef } from "@tanstack/react-table";
import { FileUp, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { cn } from "@/shadcn/lib/utils";
import type { MonthlyForecastDto } from "@/types/monthly-forecast";
import { EditableNumberCell } from "@/components/editable-cells/EditableNumberCell";

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString();
}

export type OnAdjustedForecastUpdateFn = (
  forecast: MonthlyForecastDto,
  newValue: number | null
) => Promise<void>;

export type OnAddToUploadFn = (forecast: MonthlyForecastDto) => void;
export type OnRemoveFromUploadFn = (forecast: MonthlyForecastDto) => void;

export interface ColumnsConfig {
  onAdjustedForecastUpdate: OnAdjustedForecastUpdateFn;
  onAddToUpload: OnAddToUploadFn;
  onRemoveFromUpload: OnRemoveFromUploadFn;
  addedToUpload: Set<string>;
}

export function createColumns(
  config: ColumnsConfig
): ColumnDef<MonthlyForecastDto>[] {
  const {
    onAdjustedForecastUpdate,
    onAddToUpload,
    onRemoveFromUpload,
    addedToUpload,
  } = config;

  return [
    {
      accessorKey: "location",
      header: () => (
        <span className="text-muted-foreground font-medium">Location</span>
      ),
      cell: ({ row }) => row.getValue<string>("location"),
    },
    {
      accessorKey: "itemNumber",
      header: () => (
        <span className="text-muted-foreground font-medium">Item #</span>
      ),
      cell: ({ row }) => row.getValue<string>("itemNumber"),
    },
    {
      accessorKey: "description",
      header: () => (
        <span className="text-muted-foreground font-medium">Description</span>
      ),
      cell: ({ row }) => {
        const desc = row.getValue<string>("description");
        return (
          <div className="max-w-[200px] truncate" title={desc}>
            {desc}
          </div>
        );
      },
    },
    {
      accessorKey: "threeMonthAvgActuals",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          3 Month Avg Actuals
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {formatNumber(row.getValue("threeMonthAvgActuals"))}
        </div>
      ),
    },
    {
      accessorKey: "currentActuals",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Current Actuals
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {formatNumber(row.getValue("currentActuals"))}
        </div>
      ),
    },
    {
      accessorKey: "lastYearNextMonthActuals",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          LY Next Month Actuals
        </div>
      ),
      cell: ({ row }) => {
        const lyValue = row.getValue<number>("lastYearNextMonthActuals");
        const currentActuals = row.original.currentActuals;
        const changePercent = lyValue
          ? ((currentActuals - lyValue) / lyValue) * 100
          : 0;

        return (
          <div className="text-center font-medium tabular-nums flex items-center justify-center gap-1">
            {formatNumber(lyValue)}
            <span
              className={cn(
                "text-xs",
                changePercent > 0 ? "text-green-600" : "text-red-600"
              )}
            >
              {changePercent > 0 ? "+" : ""}
              {changePercent.toFixed(0)}%
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "nextMonthForecast",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Next Month Forecast
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {formatNumber(row.getValue("nextMonthForecast"))}
        </div>
      ),
    },
    {
      accessorKey: "monthPlus2Forecast",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Month +2 Forecast
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {formatNumber(row.getValue("monthPlus2Forecast"))}
        </div>
      ),
    },
    {
      accessorKey: "monthPlus3Forecast",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Month +3 Forecast
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {formatNumber(row.getValue("monthPlus3Forecast"))}
        </div>
      ),
    },
    {
      accessorKey: "variancePercent",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Variance %
        </div>
      ),
      cell: ({ row }) => {
        const variance = row.getValue<number>("variancePercent");
        const isPositive = variance > 0;
        return (
          <div
            className={cn(
              "text-center font-medium tabular-nums",
              isPositive ? "text-green-600" : "text-red-600"
            )}
          >
            {isPositive ? "+" : ""}
            {variance.toFixed(1)}%
          </div>
        );
      },
    },
    {
      accessorKey: "adjustedForecast",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Adjusted Forecast
        </div>
      ),
      cell: ({ row }) => {
        const adjusted = row.original.adjustedForecast;
        const nextMonth = row.original.nextMonthForecast;
        const diff = adjusted - nextMonth;

        const handleIncrement = () => {
          void onAdjustedForecastUpdate(row.original, adjusted + 1);
        };

        const handleDecrement = () => {
          void onAdjustedForecastUpdate(row.original, adjusted - 1);
        };

        return (
          <div className="flex items-center justify-center gap-1">
            <div className="flex flex-col">
              <button
                type="button"
                onClick={handleIncrement}
                className="h-6 w-6 flex items-center justify-center rounded border border-border hover:bg-muted hover:border-primary/50 transition-colors cursor-pointer"
                aria-label="Increase forecast"
              >
                <ChevronUp className="h-4 w-4 text-foreground" />
              </button>
              <button
                type="button"
                onClick={handleDecrement}
                className="h-6 w-6 flex items-center justify-center rounded border border-border hover:bg-muted hover:border-primary/50 transition-colors cursor-pointer -mt-px"
                aria-label="Decrease forecast"
              >
                <ChevronDown className="h-4 w-4 text-foreground" />
              </button>
            </div>
            <EditableNumberCell
              value={adjusted}
              onSave={async (value) => {
                await onAdjustedForecastUpdate(row.original, value);
              }}
            />
            {diff !== 0 && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  diff > 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {diff > 0 ? "+" : ""}
                {diff}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "top5Customers",
      header: () => (
        <span className="text-muted-foreground font-medium">
          Top 5 Customers
        </span>
      ),
      cell: ({ row }) => {
        const customers = row.getValue<string[]>("top5Customers");
        return (
          <div className="text-sm space-y-0.5">
            {customers.map((customer, index) => (
              <div
                key={index}
                className="max-w-[180px] truncate"
                title={customer}
              >
                {index + 1}. {customer}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "dpNotes",
      header: () => (
        <span className="text-muted-foreground font-medium">DP Notes</span>
      ),
      cell: ({ row }) => {
        const notes = row.getValue<string | null>("dpNotes");
        if (!notes) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="max-w-[200px] truncate" title={notes}>
            {notes}
          </div>
        );
      },
    },
    {
      id: "action",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Action
        </div>
      ),
      cell: ({ row }) => {
        const isAdded = addedToUpload.has(row.original.id);
        return (
          <div className="text-center">
            {isAdded ? (
              <div className="inline-flex items-center gap-1">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Added
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFromUpload(row.original)}
                  className="h-6 w-6 flex items-center justify-center rounded-full border border-red-200 hover:bg-red-100 hover:border-red-400 transition-colors cursor-pointer"
                  aria-label="Remove from upload"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAddToUpload(row.original)}
              >
                <FileUp className="mr-1 h-4 w-4" />
                Add to Upload File
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
