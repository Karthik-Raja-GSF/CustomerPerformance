import type { ColumnDef, Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { cn } from "@/shadcn/lib/utils";
import type { EoRiskItemDto } from "@/types/eo-risk-review";

function SortableHeader<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>;
  title: string;
}) {
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

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString();
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString();
}

export const columns: ColumnDef<EoRiskItemDto>[] = [
  {
    accessorKey: "itemNo",
    header: ({ column }) => <SortableHeader column={column} title="Item No" />,
    cell: ({ row }) => row.getValue<string>("itemNo"),
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <SortableHeader column={column} title="Description" />
    ),
    cell: ({ row }) => {
      const desc = row.getValue<string | null>("description");
      return (
        <div className="max-w-[200px] truncate" title={desc ?? undefined}>
          {desc ?? "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "vendorName",
    header: ({ column }) => (
      <SortableHeader column={column} title="Vendor Name" />
    ),
    cell: ({ row }) => {
      const name = row.getValue<string | null>("vendorName");
      return (
        <div className="max-w-[150px] truncate" title={name ?? undefined}>
          {name ?? "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "vendorNo",
    header: () => (
      <span className="text-muted-foreground font-medium">Vendor No</span>
    ),
    cell: ({ row }) => row.getValue<string | null>("vendorNo") ?? "-",
    enableHiding: true,
  },
  {
    accessorKey: "buyerName",
    header: () => (
      <span className="text-muted-foreground font-medium">Buyer</span>
    ),
    cell: ({ row }) => row.getValue<string | null>("buyerName") ?? "-",
    enableHiding: true,
  },
  {
    accessorKey: "location",
    header: ({ column }) => <SortableHeader column={column} title="Location" />,
    cell: ({ row }) => row.getValue<string>("location"),
  },
  {
    accessorKey: "sourceDb",
    header: () => (
      <span className="text-muted-foreground font-medium">Source</span>
    ),
    cell: ({ row }) => row.getValue<string>("sourceDb"),
    enableHiding: true,
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => (
      <div className="flex justify-center">
        <SortableHeader column={column} title="Quantity" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center font-medium tabular-nums">
        {formatNumber(row.getValue("quantity"))}
      </div>
    ),
  },
  {
    accessorKey: "totalValue",
    header: ({ column }) => (
      <div className="flex justify-center">
        <SortableHeader column={column} title="Total Value" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center font-medium tabular-nums">
        {formatCurrency(row.getValue("totalValue"))}
      </div>
    ),
  },
  {
    accessorKey: "daysInInventory",
    header: ({ column }) => (
      <div className="flex justify-center">
        <SortableHeader column={column} title="Days in Inv." />
      </div>
    ),
    cell: ({ row }) => {
      const days = row.getValue<number>("daysInInventory");
      return (
        <div
          className={cn(
            "text-center font-bold tabular-nums",
            days >= 30 ? "text-red-600" : "text-green-600"
          )}
        >
          {days}
        </div>
      );
    },
  },
  {
    accessorKey: "expirationDate",
    header: () => (
      <span className="text-muted-foreground font-medium">Expiration</span>
    ),
    cell: ({ row }) => formatDate(row.getValue("expirationDate")),
  },
  {
    accessorKey: "avgWeeklySale",
    header: ({ column }) => (
      <div className="flex justify-center">
        <SortableHeader column={column} title="Avg Weekly Sale" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-center font-medium tabular-nums">
        {formatNumber(row.getValue("avgWeeklySale"))}
      </div>
    ),
  },
  {
    accessorKey: "criteriaMet",
    header: () => (
      <span className="text-muted-foreground font-medium">Criteria Met</span>
    ),
    cell: ({ row }) => {
      const criteria = row.getValue<string[]>("criteriaMet");
      if (!criteria || criteria.length === 0) return "-";
      return (
        <div className="flex flex-wrap gap-1">
          {criteria.map((c) => (
            <Badge
              key={c}
              className="border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 whitespace-nowrap"
            >
              {c}
            </Badge>
          ))}
        </div>
      );
    },
  },
];
