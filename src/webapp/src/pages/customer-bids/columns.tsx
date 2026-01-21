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

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return value.toLocaleString();
}

export const columns: ColumnDef<CustomerBidDto>[] = [
  {
    accessorKey: "siteCode",
    header: ({ column }) => (
      <SortableHeader column={column} title="Site Code" />
    ),
    cell: ({ row }) => row.getValue("siteCode") ?? "-",
  },
  {
    accessorKey: "customerName",
    header: ({ column }) => (
      <SortableHeader column={column} title="Customer Name" />
    ),
    cell: ({ row }) => row.getValue("customerName") ?? "-",
  },
  {
    accessorKey: "customerBillTo",
    header: () => (
      <span className="text-muted-foreground font-medium">
        Customer Bill To
      </span>
    ),
    cell: ({ row }) => row.getValue("customerBillTo") ?? "-",
  },
  {
    accessorKey: "contactName",
    header: () => (
      <span className="text-muted-foreground font-medium">Contact</span>
    ),
    cell: ({ row }) => row.getValue("contactName") ?? "-",
  },
  {
    accessorKey: "contactEmail",
    header: () => (
      <span className="text-muted-foreground font-medium">Email</span>
    ),
    cell: ({ row }) => {
      const email = row.getValue("contactEmail");
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
      <span className="text-muted-foreground font-medium">Phone</span>
    ),
    cell: ({ row }) => row.getValue("contactPhone") ?? "-",
  },
  {
    accessorKey: "salesRep",
    header: ({ column }) => (
      <SortableHeader column={column} title="Sales Rep" />
    ),
    cell: ({ row }) => row.getValue("salesRep") ?? "-",
  },
  {
    accessorKey: "wonLost",
    header: () => (
      <span className="text-muted-foreground font-medium">Status</span>
    ),
    cell: ({ row }) => {
      const status = row.getValue("wonLost");
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
    cell: ({ row }) => row.getValue("itemCode"),
  },
  {
    accessorKey: "itemDescription",
    header: () => (
      <span className="text-muted-foreground font-medium">
        Item Description
      </span>
    ),
    cell: ({ row }) => {
      const desc = row.getValue("itemDescription");
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
    cell: ({ row }) => row.getValue("erpStatus") ?? "-",
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
];
