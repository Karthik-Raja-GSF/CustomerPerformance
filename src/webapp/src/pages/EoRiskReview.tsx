import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shadcn/components/dropdown-menu";
import { getEoRiskItems, getEoFilterOptions } from "@/apis/eo-risk-review";
import type {
  EoRiskItemDto,
  EoRiskReviewFilters,
  EoFilterOptions,
} from "@/types/eo-risk-review";
import {
  DataTable,
  type VisibilityState,
} from "@/pages/eo-risk-review/data-table";
import { columns } from "@/pages/eo-risk-review/columns";
import { CriteriaInfo } from "@/pages/eo-risk-review/criteria-info";
import {
  EoFilterSheet,
  EMPTY_EO_FILTER_INPUTS,
  type EoFilterInputs,
} from "@/pages/eo-risk-review/filter-sheet";
import { exportToCSV, type ExportColumn } from "@/utils/export-csv";
import type { Table } from "@tanstack/react-table";

const DEFAULT_LIMIT = 50;
const DEFAULT_AGING_DAYS = 30;
const DEFAULT_LOOKBACK_DAYS = 45;
const DEFAULT_EXCESS_DAYS = 60;

const eoExportColumns: ExportColumn[] = [
  { key: "itemNo", header: "Item No" },
  { key: "description", header: "Description" },
  { key: "vendorName", header: "Vendor Name" },
  { key: "vendorNo", header: "Vendor No" },
  { key: "buyerName", header: "Buyer" },
  { key: "location", header: "Location" },
  { key: "sourceDb", header: "Source DB" },
  { key: "quantity", header: "Quantity" },
  {
    key: "totalValue",
    header: "Total Value",
    format: (v) => (v != null ? Number(v).toFixed(2) : ""),
  },
  { key: "daysInInventory", header: "Days in Inventory" },
  { key: "expirationDate", header: "Expiration Date" },
  { key: "avgWeeklySale", header: "Avg Weekly Sale" },
  {
    key: "criteriaMet",
    header: "Criteria Met",
    format: (v) =>
      Array.isArray(v)
        ? (v as string[]).join("; ")
        : typeof v === "string"
          ? v
          : "",
  },
];

function parseFiltersFromURL(
  searchParams: URLSearchParams
): EoRiskReviewFilters {
  return {
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    limit: searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : DEFAULT_LIMIT,
    location: searchParams.get("location") || undefined,
    itemNo: searchParams.get("itemNo") || undefined,
    sourceDb: searchParams.get("sourceDb") || undefined,
    agingDays: searchParams.get("agingDays")
      ? Number(searchParams.get("agingDays"))
      : DEFAULT_AGING_DAYS,
    lookbackDays: searchParams.get("lookbackDays")
      ? Number(searchParams.get("lookbackDays"))
      : DEFAULT_LOOKBACK_DAYS,
    excessDays: searchParams.get("excessDays")
      ? Number(searchParams.get("excessDays"))
      : DEFAULT_EXCESS_DAYS,
  };
}

function filtersToURLParams(filters: EoRiskReviewFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page !== 1) params.set("page", String(filters.page));
  if (filters.limit !== DEFAULT_LIMIT)
    params.set("limit", String(filters.limit));
  if (filters.location) params.set("location", filters.location);
  if (filters.itemNo) params.set("itemNo", filters.itemNo);
  if (filters.sourceDb) params.set("sourceDb", filters.sourceDb);
  if (filters.agingDays !== DEFAULT_AGING_DAYS)
    params.set("agingDays", String(filters.agingDays));
  if (filters.lookbackDays !== DEFAULT_LOOKBACK_DAYS)
    params.set("lookbackDays", String(filters.lookbackDays));
  if (filters.excessDays !== DEFAULT_EXCESS_DAYS)
    params.set("excessDays", String(filters.excessDays));
  return params;
}

export default function EoRiskReview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);
  const isUrlSyncInitMount = useRef(true);

  const [items, setItems] = useState<EoRiskItemDto[]>([]);
  const [totalItemsAtRisk, setTotalItemsAtRisk] = useState(0);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    hasMore: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<EoRiskReviewFilters>(() =>
    parseFiltersFromURL(searchParams)
  );

  const [filterInputs, setFilterInputs] = useState<EoFilterInputs>(() => ({
    location: searchParams.get("location") || "",
    itemNo: searchParams.get("itemNo") || "",
    sourceDb: searchParams.get("sourceDb") || "",
  }));

  const [filterOptions, setFilterOptions] = useState<EoFilterOptions | null>(
    null
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    vendorNo: false,
    buyerName: false,
    sourceDb: false,
  });
  const [tableInstance, setTableInstance] =
    useState<Table<EoRiskItemDto> | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);

  const fetchData = useCallback(async (currentFilters: EoRiskReviewFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getEoRiskItems(currentFilters);
      setItems(response.data);
      setTotalItemsAtRisk(response.totalItemsAtRisk);
      setPagination({
        page: response.page,
        limit: response.limit,
        hasMore: response.hasMore,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch risk items";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(filters);
  }, [filters, fetchData]);

  // Fetch filter options when the filter sheet is opened
  useEffect(() => {
    if (!filterSheetOpen) return;
    const load = async () => {
      try {
        const options = await getEoFilterOptions();
        setFilterOptions(options);
      } catch {
        // Filter options are nice-to-have; silently degrade
      }
    };
    void load();
  }, [filterSheetOpen]);

  // Sync filters → URL (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const newParams = filtersToURLParams(filters);
    setSearchParams(newParams, { replace: true });
  }, [filters, setSearchParams]);

  // Sync URL → filters (browser back/forward)
  useEffect(() => {
    if (isUrlSyncInitMount.current) {
      isUrlSyncInitMount.current = false;
      return;
    }
    const urlFilters = parseFiltersFromURL(searchParams);
    const currentStr = JSON.stringify({
      ...filters,
      location: filters.location || undefined,
      itemNo: filters.itemNo || undefined,
      sourceDb: filters.sourceDb || undefined,
    });
    const urlStr = JSON.stringify(urlFilters);
    if (urlStr !== currentStr) {
      setFilters(urlFilters);
      setFilterInputs({
        location: urlFilters.location || "",
        itemNo: urlFilters.itemNo || "",
        sourceDb: urlFilters.sourceDb || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      location: filterInputs.location || undefined,
      itemNo: filterInputs.itemNo || undefined,
      sourceDb: filterInputs.sourceDb || undefined,
    }));
    setFilterSheetOpen(false);
  };

  const handleClearFilters = () => {
    setFilterInputs(EMPTY_EO_FILTER_INPUTS);
    setFilters((prev) => ({
      page: 1,
      limit: prev.limit,
      agingDays: prev.agingDays,
      lookbackDays: prev.lookbackDays,
      excessDays: prev.excessDays,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setFilters((prev) => ({ ...prev, page: 1, limit: newSize }));
  };

  const hasActiveFilters = Boolean(
    filterInputs.location || filterInputs.itemNo || filterInputs.sourceDb
  );

  const activeFilterCount = [
    filterInputs.location,
    filterInputs.itemNo,
    filterInputs.sourceDb,
  ].filter(Boolean).length;

  const visibleColumns = useMemo(
    () =>
      tableInstance?.getAllColumns().filter((column) => column.getCanHide()) ??
      [],
    [tableInstance]
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-8 min-h-0 overflow-hidden">
      {/* Criteria info section */}
      <CriteriaInfo itemsUnderReview={totalItemsAtRisk} />

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3">
        <div className="flex-1" />

        {/* Filter Sheet */}
        <EoFilterSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          filterInputs={filterInputs}
          setFilterInputs={setFilterInputs}
          filterOptions={filterOptions}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
          onSearch={handleSearch}
          onClear={handleClearFilters}
        />

        {/* Column visibility dropdown */}
        <DropdownMenu
          open={columnsDropdownOpen}
          onOpenChange={setColumnsDropdownOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {visibleColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize cursor-pointer"
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(checked)}
                onSelect={() => {
                  setTimeout(() => setColumnsDropdownOpen(true), 0);
                }}
              >
                {column.id.replace(/([A-Z])/g, " $1").trim()}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export CSV */}
        <Button
          variant="outline"
          size="sm"
          disabled={items.length === 0 || isLoading}
          onClick={() => {
            exportToCSV(items, eoExportColumns, "eo-risk-review");
            toast.success("CSV exported successfully");
          }}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>

        {/* Refresh */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => fetchData(filters)}
          disabled={isLoading}
          aria-label="Refresh data"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Data Table */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          error={error}
          onRetry={() => fetchData(filters)}
          pagination={pagination}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          hasFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          onTableReady={setTableInstance}
        />
      </div>
    </div>
  );
}
