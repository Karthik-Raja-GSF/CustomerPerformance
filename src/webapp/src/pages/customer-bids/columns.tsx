import { useMemo, useState, type ReactNode } from "react";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { cn } from "@/shadcn/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shadcn/components/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shadcn/components/tooltip";
import type {
  CustomerBidDto,
  UpdateCustomerBidDto,
} from "@/types/customer-bids";
import { EditableNumberCell } from "@/components/editable-cells/EditableNumberCell";
import { EditableCheckboxCell } from "@/components/editable-cells/EditableCheckboxCell";
import { EditableMonthsCell } from "@/components/editable-cells/EditableMonthsCell";
import {
  ESTIMATE_MONTHS,
  YEAR_AROUND_ESTIMATE_MONTHS,
} from "@/utils/menu-months";

/** Conversion rate color thresholds (%). Green if within range, red otherwise. */
const CONVERSION_RATE_THRESHOLDS = { min: 70, max: 100 } as const;

/**
 * Get visible estimate months based on yearAround and menuMonths selection
 * - If yearAround=true: show Aug, Sep, Oct
 * - If yearAround=false: show months selected in menuMonths
 */
function getVisibleEstimateMonths(
  data: CustomerBidDto
): (typeof ESTIMATE_MONTHS)[number][] {
  if (data.yearAround) {
    // Year Around = true: show Aug, Sep, Oct
    return ESTIMATE_MONTHS.filter((m) =>
      YEAR_AROUND_ESTIMATE_MONTHS.includes(
        m.menuKey as (typeof YEAR_AROUND_ESTIMATE_MONTHS)[number]
      )
    );
  }
  // Year Around = false: show selected menu months
  return ESTIMATE_MONTHS.filter((m) => data[m.menuKey] === true);
}

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

function SortableHeader<TData, TValue>({
  column,
  title,
}: SortableHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn("-ml-4", sorted && "text-foreground")}
      aria-label={`Sort by ${title}${sorted ? (sorted === "asc" ? ", currently ascending" : ", currently descending") : ""}`}
    >
      {title}
      {sorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : sorted === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
}

function formatNumber(value: number | null | undefined): React.ReactNode {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString();
}

/**
 * Check whether a bid meets the requirements for confirmation:
 * at least one month with an estimate > 0 AND that month on the menu.
 */
export function canConfirmBid(bid: CustomerBidDto): boolean {
  const months = [
    { estimate: "estimateJan", menu: "menuJan" },
    { estimate: "estimateFeb", menu: "menuFeb" },
    { estimate: "estimateMar", menu: "menuMar" },
    { estimate: "estimateApr", menu: "menuApr" },
    { estimate: "estimateMay", menu: "menuMay" },
    { estimate: "estimateJun", menu: "menuJun" },
    { estimate: "estimateJul", menu: "menuJul" },
    { estimate: "estimateAug", menu: "menuAug" },
    { estimate: "estimateSep", menu: "menuSep" },
    { estimate: "estimateOct", menu: "menuOct" },
    { estimate: "estimateNov", menu: "menuNov" },
    { estimate: "estimateDec", menu: "menuDec" },
  ] as const;

  return months.some((m) => {
    const est = bid[m.estimate];
    const hasEstimate = est != null && est > 0;
    const hasMenu = bid.yearAround || bid[m.menu] === true;
    return hasEstimate && hasMenu;
  });
}

function ConfirmCell({
  bid,
  onConfirm,
  onUnconfirm,
  canUnconfirm = true,
}: {
  bid: CustomerBidDto;
  onConfirm: (bid: CustomerBidDto) => Promise<void>;
  onUnconfirm: (bid: CustomerBidDto) => Promise<void>;
  canUnconfirm?: boolean;
}): ReactNode {
  const [isLoading, setIsLoading] = useState(false);
  const isConfirmed = !!bid.confirmedAt;

  const canConfirm = useMemo(() => canConfirmBid(bid), [bid]);

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isConfirmed && canUnconfirm) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="flex flex-col items-center text-xs cursor-pointer hover:opacity-80"
          >
            <span className="truncate max-w-[120px]">{bid.confirmedBy}</span>
            <span className="text-muted-foreground">
              {bid.confirmedAt
                ? new Date(bid.confirmedAt).toLocaleString()
                : ""}
            </span>
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unconfirm this bid?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the confirmation from this bid record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleAction(() => onUnconfirm(bid))}
            >
              Unconfirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (isConfirmed) {
    return (
      <div className="flex flex-col items-center text-xs">
        <span className="truncate max-w-[120px]">{bid.confirmedBy}</span>
        <span className="text-muted-foreground">
          {bid.confirmedAt ? new Date(bid.confirmedAt).toLocaleString() : ""}
        </span>
      </div>
    );
  }

  if (!canConfirm) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>
            <Button variant="outline" size="sm" disabled>
              Confirm
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Add at least one estimate with a menu month to confirm</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          Confirm
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm this bid?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark the bid as confirmed with your email and the current
            timestamp.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => void handleAction(() => onConfirm(bid))}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type OnCellUpdateFn = (
  bid: CustomerBidDto,
  updates: UpdateCustomerBidDto
) => Promise<void>;

export interface ColumnsConfig {
  onCellUpdate: OnCellUpdateFn;
  onConfirm: (bid: CustomerBidDto) => Promise<void>;
  onUnconfirm: (bid: CustomerBidDto) => Promise<void>;
  canUnconfirm?: boolean;
}

export function createColumns(
  config: ColumnsConfig
): ColumnDef<CustomerBidDto>[] {
  const { onCellUpdate, onConfirm, onUnconfirm, canUnconfirm = true } = config;

  return [
    // Source DB - hidden by default
    {
      accessorKey: "sourceDb",
      header: () => (
        <span className="text-muted-foreground font-medium">Source</span>
      ),
      cell: ({ row }) => row.getValue<string | null>("sourceDb") ?? "-",
      enableHiding: true,
    },
    {
      accessorKey: "siteCode",
      header: ({ column }) => (
        <SortableHeader column={column} title="Site Code" />
      ),
      cell: ({ row }) => row.getValue<string | null>("siteCode") ?? "-",
    },
    {
      accessorKey: "customerName",
      header: ({ column }) => (
        <SortableHeader column={column} title="Customer Name" />
      ),
      cell: ({ row }) => row.getValue<string | null>("customerName") ?? "-",
    },
    {
      accessorKey: "customerBillTo",
      header: () => (
        <span className="text-muted-foreground font-medium">
          Customer Bill To
        </span>
      ),
      cell: ({ row }) => row.getValue<string | null>("customerBillTo") ?? "-",
    },
    {
      accessorKey: "coOpCode",
      header: () => (
        <span className="text-muted-foreground font-medium">Co-op Code</span>
      ),
      cell: ({ row }) => row.getValue<string | null>("coOpCode") ?? "-",
    },
    {
      accessorKey: "contactName",
      header: () => (
        <span className="text-muted-foreground font-medium">Contact Name</span>
      ),
      cell: ({ row }) => row.getValue<string | null>("contactName") ?? "-",
    },
    {
      accessorKey: "contactEmail",
      header: () => (
        <span className="text-muted-foreground font-medium">Contact Email</span>
      ),
      cell: ({ row }) => {
        const email = row.getValue<string | null>("contactEmail");
        return (
          <div className="max-w-[180px] truncate" title={email ?? undefined}>
            {email ?? "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "contactPhone",
      header: () => (
        <span className="text-muted-foreground font-medium">Contact Phone</span>
      ),
      cell: ({ row }) => row.getValue<string | null>("contactPhone") ?? "-",
      enableHiding: true,
    },
    {
      accessorKey: "salesRep",
      header: ({ column }) => (
        <SortableHeader column={column} title="Sales Rep" />
      ),
      cell: ({ row }) => row.getValue<string | null>("salesRep") ?? "-",
    },
    // isLost - Badge display (RENEWED/NEW)
    {
      accessorKey: "isLost",
      header: () => (
        <span className="text-muted-foreground font-medium">Renewed/New</span>
      ),
      cell: ({ row }) => {
        const isLost = row.getValue<boolean>("isLost");
        return (
          <Badge
            className={
              isLost
                ? "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300"
                : "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
            }
          >
            {isLost ? "NEW" : "RENEWED"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "bidStartDate",
      header: ({ column }) => (
        <SortableHeader column={column} title="Bid Start" />
      ),
      cell: ({ row }) => formatDate(row.getValue("bidStartDate")),
    },
    {
      accessorKey: "bidEndDate",
      header: () => (
        <span className="text-muted-foreground font-medium">Bid End</span>
      ),
      cell: ({ row }) => formatDate(row.getValue("bidEndDate")),
    },
    {
      accessorKey: "itemCode",
      header: ({ column }) => (
        <SortableHeader column={column} title="Item Code" />
      ),
      cell: ({ row }) => row.getValue<string>("itemCode"),
    },
    {
      accessorKey: "brandName",
      header: () => (
        <span className="text-muted-foreground font-medium">Brand Name</span>
      ),
      cell: ({ row }) => {
        const brand = row.getValue<string | null>("brandName");
        return (
          <div className="max-w-[150px] truncate" title={brand ?? undefined}>
            {brand ?? "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "itemDescription",
      header: () => (
        <span className="text-muted-foreground font-medium">
          Item Description
        </span>
      ),
      cell: ({ row }) => {
        const desc = row.getValue<string | null>("itemDescription");
        return (
          <div className="max-w-[200px] truncate" title={desc ?? undefined}>
            {desc ?? "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "erpStatus",
      header: () => (
        <span className="text-muted-foreground font-medium">ERP Status</span>
      ),
      cell: ({ row }) => row.getValue<string | null>("erpStatus") ?? "-",
      enableHiding: true,
    },
    {
      accessorKey: "bidQuantity",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          Bid Qty
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("bidQuantity"))}
        </div>
      ),
    },
    {
      accessorKey: "lastYearBidQty",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          LY Bid Qty
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("lastYearBidQty"))}
        </div>
      ),
    },
    {
      accessorKey: "lastYearActual",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          LY Actual
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("lastYearActual"))}
        </div>
      ),
    },
    // Conversion Rate: (LY Actual / LY Bid Qty) * 100
    {
      id: "conversionRate",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          Conv Rate
        </div>
      ),
      cell: ({ row }) => {
        const lyActual = row.original.lastYearActual;
        const lyBidQty = row.original.lastYearBidQty;

        // Can't calculate if bid qty is 0, null, or if actual is null
        if (!lyBidQty || lyBidQty === 0 || lyActual === null) {
          return <div className="text-right text-muted-foreground">-</div>;
        }

        const rate = (lyActual / lyBidQty) * 100;
        const isHealthy =
          rate >= CONVERSION_RATE_THRESHOLDS.min &&
          rate <= CONVERSION_RATE_THRESHOLDS.max;
        return (
          <div
            className={cn(
              "text-right font-medium tabular-nums",
              isHealthy ? "text-green-600" : "text-red-600"
            )}
          >
            {rate.toFixed(1)}%
          </div>
        );
      },
    },
    {
      accessorKey: "lyAugust",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          LY Aug
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("lyAugust"))}
        </div>
      ),
    },
    {
      accessorKey: "lySeptember",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          LY Sep
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("lySeptember"))}
        </div>
      ),
    },
    {
      accessorKey: "lyOctober",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          LY Oct
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatNumber(row.getValue("lyOctober"))}
        </div>
      ),
    },
    // User-editable columns
    {
      accessorKey: "yearAround",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Year Around
        </div>
      ),
      cell: ({ row }) => {
        const isConfirmed = !!row.original.confirmedAt;
        return (
          <EditableCheckboxCell
            value={row.original.yearAround}
            disabled={isConfirmed}
            onSave={async (value) => {
              if (value) {
                // Year Around checked: populate Aug, Sep, Oct with last year's values
                await onCellUpdate(row.original, {
                  yearAround: true,
                  estimateAug: row.original.lyAugust,
                  estimateSep: row.original.lySeptember,
                  estimateOct: row.original.lyOctober,
                });
              } else {
                await onCellUpdate(row.original, { yearAround: false });
              }
            }}
          />
        );
      },
    },
    {
      id: "menuMonths",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Menu Months
        </div>
      ),
      cell: ({ row }) => {
        const isConfirmed = !!row.original.confirmedAt;
        return (
          <EditableMonthsCell
            data={row.original}
            yearAround={row.original.yearAround}
            disabled={isConfirmed}
            onSave={async (updates) => {
              await onCellUpdate(row.original, updates);
            }}
          />
        );
      },
    },
    // Dynamic Estimates column - shows based on yearAround and menuMonths
    {
      id: "estimates",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Estimates
        </div>
      ),
      cell: ({ row }) => {
        const visibleMonths = getVisibleEstimateMonths(row.original);

        if (visibleMonths.length === 0) {
          return <div className="text-center text-muted-foreground">-</div>;
        }

        return (
          <div className="flex gap-2 justify-center">
            {visibleMonths.map((month) => {
              const estimateKey = month.estimateKey;
              return (
                <div
                  key={month.menuKey}
                  className="flex flex-col items-center min-w-[60px]"
                >
                  <span className="text-xs text-muted-foreground mb-1">
                    {month.label}
                  </span>
                  <EditableNumberCell
                    value={row.original[estimateKey]}
                    onSave={async (value) => {
                      await onCellUpdate(row.original, {
                        [estimateKey]: value,
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "confirmed",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Confirmed
        </div>
      ),
      cell: ({ row }) => (
        <ConfirmCell
          bid={row.original}
          onConfirm={onConfirm}
          onUnconfirm={onUnconfirm}
          canUnconfirm={canUnconfirm}
        />
      ),
    },
    {
      id: "lastUpdated",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Last Updated
        </div>
      ),
      cell: ({ row }) => {
        const { lastUpdatedBy, lastUpdatedAt } = row.original;
        if (!lastUpdatedBy && !lastUpdatedAt) {
          return <div className="text-center text-muted-foreground">-</div>;
        }
        return (
          <div className="flex flex-col items-center text-xs">
            <span
              className="truncate max-w-[120px]"
              title={lastUpdatedBy ?? undefined}
            >
              {lastUpdatedBy ?? "-"}
            </span>
            <span className="text-muted-foreground">
              {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "-"}
            </span>
          </div>
        );
      },
    },
  ];
}

// Legacy export for backwards compatibility (non-editable)
export const columns: ColumnDef<CustomerBidDto>[] = createColumns({
  onCellUpdate: async () => {
    console.warn("Cell update not configured");
  },
  onConfirm: async () => {
    console.warn("Confirm not configured");
  },
  onUnconfirm: async () => {
    console.warn("Unconfirm not configured");
  },
});
