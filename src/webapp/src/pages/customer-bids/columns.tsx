import type React from "react";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { cn } from "@/shadcn/lib/utils";
import type {
  CustomerBidDto,
  UpdateCustomerBidDto,
} from "@/types/customer-bids";
import { EditableNumberCell } from "@/components/editable-cells/EditableNumberCell";
import { EditableCheckboxCell } from "@/components/editable-cells/EditableCheckboxCell";
import { EditableMonthsCell } from "@/components/editable-cells/EditableMonthsCell";

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

export type OnCellUpdateFn = (
  bid: CustomerBidDto,
  updates: UpdateCustomerBidDto
) => Promise<void>;

export interface ColumnsConfig {
  onCellUpdate: OnCellUpdateFn;
}

export function createColumns(
  config: ColumnsConfig
): ColumnDef<CustomerBidDto>[] {
  const { onCellUpdate } = config;

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
    // isLost - Badge display (WON/LOST)
    {
      accessorKey: "isLost",
      header: () => (
        <span className="text-muted-foreground font-medium">Won/Lost</span>
      ),
      cell: ({ row }) => {
        const isLost = row.getValue<boolean>("isLost");
        return (
          <Badge variant={isLost ? "destructive" : "default"}>
            {isLost ? "LOST" : "WON"}
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
        return (
          <div className="text-right font-medium tabular-nums">
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
      cell: ({ row }) => (
        <EditableCheckboxCell
          value={row.original.yearAround}
          onSave={async (value) => {
            if (value) {
              // When setting yearAround, also confirm and copy LY values
              await onCellUpdate(row.original, {
                yearAround: value,
                confirmed: true,
                augustDemand: row.original.lyAugust ?? 0,
                septemberDemand: row.original.lySeptember ?? 0,
                octoberDemand: row.original.lyOctober ?? 0,
              });
            } else {
              // When unchecking yearAround, also unconfirm and clear demand values
              await onCellUpdate(row.original, {
                yearAround: value,
                confirmed: false,
                augustDemand: null,
                septemberDemand: null,
                octoberDemand: null,
              });
            }
          }}
        />
      ),
    },
    {
      id: "menuMonths",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Menu Months
        </div>
      ),
      cell: ({ row }) => (
        <EditableMonthsCell
          data={row.original}
          yearAround={row.original.yearAround}
          onSave={async (updates) => {
            await onCellUpdate(row.original, updates);
          }}
        />
      ),
    },
    {
      accessorKey: "confirmed",
      header: () => (
        <div className="text-center text-muted-foreground font-medium">
          Confirmed
        </div>
      ),
      cell: ({ row }) => (
        <EditableCheckboxCell
          value={row.original.confirmed}
          onSave={async (value) => {
            if (value) {
              // When confirming, copy LY values to demand fields
              await onCellUpdate(row.original, {
                confirmed: value,
                augustDemand: row.original.lyAugust ?? 0,
                septemberDemand: row.original.lySeptember ?? 0,
                octoberDemand: row.original.lyOctober ?? 0,
              });
            } else {
              // When unconfirming, clear demand values
              await onCellUpdate(row.original, {
                confirmed: value,
                augustDemand: null,
                septemberDemand: null,
                octoberDemand: null,
              });
            }
          }}
        />
      ),
    },
    {
      accessorKey: "augustDemand",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          Aug Demand
        </div>
      ),
      cell: ({ row }) => (
        <EditableNumberCell
          value={row.original.augustDemand}
          onSave={async (value) => {
            await onCellUpdate(row.original, { augustDemand: value });
          }}
        />
      ),
    },
    {
      accessorKey: "septemberDemand",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          Sep Demand
        </div>
      ),
      cell: ({ row }) => (
        <EditableNumberCell
          value={row.original.septemberDemand}
          onSave={async (value) => {
            await onCellUpdate(row.original, { septemberDemand: value });
          }}
        />
      ),
    },
    {
      accessorKey: "octoberDemand",
      header: () => (
        <div className="text-right text-muted-foreground font-medium">
          Oct Demand
        </div>
      ),
      cell: ({ row }) => (
        <EditableNumberCell
          value={row.original.octoberDemand}
          onSave={async (value) => {
            await onCellUpdate(row.original, { octoberDemand: value });
          }}
        />
      ),
    },
  ];
}

// Legacy export for backwards compatibility (non-editable)
export const columns: ColumnDef<CustomerBidDto>[] = createColumns({
  onCellUpdate: async () => {
    console.warn("Cell update not configured");
  },
});
