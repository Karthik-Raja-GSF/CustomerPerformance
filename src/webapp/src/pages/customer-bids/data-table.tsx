import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  RefreshCw,
  SearchX,
} from "lucide-react";

import { Button } from "@/shadcn/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
  } | null;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  hasFilters?: boolean;
  onClearFilters?: () => void;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
  onTableReady?: (table: TanstackTable<TData>) => void;
}

// Export VisibilityState for use in parent components
export type { VisibilityState };

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  error = null,
  onRetry,
  pagination,
  onPageChange,
  onPageSizeChange,
  hasFilters = false,
  onClearFilters,
  columnVisibility: controlledColumnVisibility,
  onColumnVisibilityChange,
  onTableReady,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] =
    React.useState<VisibilityState>({
      contactPhone: false,
      customerBillTo: false,
      erpStatus: false,
    });

  // Use controlled visibility if provided, otherwise use internal state
  const columnVisibility =
    controlledColumnVisibility ?? internalColumnVisibility;

  const handleColumnVisibilityChange = React.useCallback(
    (
      updaterOrValue:
        | VisibilityState
        | ((old: VisibilityState) => VisibilityState)
    ) => {
      const newValue =
        typeof updaterOrValue === "function"
          ? updaterOrValue(columnVisibility)
          : updaterOrValue;
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(newValue);
      } else {
        setInternalColumnVisibility(newValue);
      }
    },
    [columnVisibility, onColumnVisibilityChange]
  );

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: handleColumnVisibilityChange,
    state: {
      sorting,
      columnVisibility,
    },
  });

  // Notify parent when table is ready
  React.useEffect(() => {
    onTableReady?.(table);
  }, [table, onTableReady]);

  return (
    <div className="flex flex-col h-full">
      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border [&_[data-slot=table-container]]:overflow-auto [&_[data-slot=table-container]]:h-full">
        <Table className="relative">
          <TableHeader className="sticky top-0 z-10 bg-muted/60">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="hover:bg-transparent border-b"
              >
                {headerGroup.headers.map((header) => {
                  const isSorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap first:pl-4 last:pr-4"
                      aria-sort={
                        isSorted
                          ? isSorted === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div role="status" aria-label="Loading data">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto" />
                    <span className="sr-only">Loading...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div
                    className="flex flex-col items-center gap-2"
                    role="alert"
                  >
                    <p className="text-destructive">{error}</p>
                    {onRetry && (
                      <Button variant="outline" size="sm" onClick={onRetry}>
                        Retry
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className={index % 2 === 1 ? "bg-muted/30" : ""}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="whitespace-nowrap first:pl-4 last:pr-4 py-3"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <SearchX className="h-10 w-10" />
                    <div className="space-y-1">
                      <p className="font-medium">No results found</p>
                      <p className="text-sm">
                        {hasFilters
                          ? "Try adjusting your filters to find what you're looking for."
                          : "No data available at this time."}
                      </p>
                    </div>
                    {hasFilters && onClearFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-5 gap-6 flex-wrap">
        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={String(pagination?.limit ?? 50)}
            onValueChange={(value) => onPageSizeChange?.(Number(value))}
            disabled={isLoading}
          >
            <SelectTrigger
              className="h-8 w-[70px]"
              aria-label="Select page size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange?.(1)}
            disabled={!pagination || pagination.page <= 1 || isLoading}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange?.((pagination?.page ?? 1) - 1)}
            disabled={!pagination || pagination.page <= 1 || isLoading}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground px-2">
            Page {pagination?.page ?? 1}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange?.((pagination?.page ?? 1) + 1)}
            disabled={!pagination || !pagination.hasMore || isLoading}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Record count */}
        <p className="text-sm text-muted-foreground">
          {pagination ? (
            <>
              Showing {(pagination.page - 1) * pagination.limit + 1}-
              {(pagination.page - 1) * pagination.limit + (data?.length ?? 0)}
            </>
          ) : (
            "Loading..."
          )}
        </p>
      </div>
    </div>
  );
}
