import type React from "react";
import { type Column, type ColumnDef } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { cn } from "@/shadcn/lib/utils";
import type { CustomerBidDto } from "@/types/customer-bids";

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

function formatNumber(value: number | string | null): React.ReactNode {
  if (value === null) return "-";
  if (typeof value === "string") {
    return <span className="text-muted-foreground italic">{value}</span>;
  }
  return value.toLocaleString();
}

export const columns: ColumnDef<CustomerBidDto>[] = [
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
  },
  {
    accessorKey: "salesRep",
    header: ({ column }) => (
      <SortableHeader column={column} title="Sales Rep" />
    ),
    cell: ({ row }) => row.getValue<string | null>("salesRep") ?? "-",
  },
  {
    accessorKey: "wonLost",
    header: () => (
      <span className="text-muted-foreground font-medium">Won/Lost</span>
    ),
    cell: ({ row }) => {
      const status = row.getValue<string>("wonLost");
      if (status === "Coming Soon..") {
        return <span className="text-muted-foreground italic">{status}</span>;
      }
      return (
        <Badge variant={status === "WON" ? "default" : "destructive"}>
          {status}
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
        Last Year Qty
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
  {
    accessorKey: "lastYearAugust",
    header: () => (
      <div className="text-right text-muted-foreground font-medium">
        LY August
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {formatNumber(row.getValue("lastYearAugust"))}
      </div>
    ),
  },
  {
    accessorKey: "lastYearSeptember",
    header: () => (
      <div className="text-right text-muted-foreground font-medium">
        LY September
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {formatNumber(row.getValue("lastYearSeptember"))}
      </div>
    ),
  },
  {
    accessorKey: "lastYearOctober",
    header: () => (
      <div className="text-right text-muted-foreground font-medium">
        LY October
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {formatNumber(row.getValue("lastYearOctober"))}
      </div>
    ),
  },
];
