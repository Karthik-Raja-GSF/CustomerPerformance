import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, Download, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import { FilterCombobox } from "@/components/filter-combobox";
import { Badge } from "@/shadcn/components/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shadcn/components/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shadcn/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/shadcn/components/tabs";
import {
  getCustomerBids,
  getCustomerBidFilterOptions,
  updateCustomerBid,
  buildBidKey,
} from "@/apis/customer-bids";
import type {
  CustomerBidDto,
  CustomerBidFilters,
  CustomerBidFilterOptions,
  PaginationDto,
  SchoolYear,
  DateRangeDto,
  UpdateCustomerBidDto,
} from "@/types/customer-bids";
import {
  DataTable,
  type VisibilityState,
} from "@/pages/customer-bids/data-table";
import { createColumns } from "@/pages/customer-bids/columns";
import {
  exportToCSV,
  exportToSIQCSV,
  customerBidExportColumns,
} from "@/utils/export-csv";
import type { Table } from "@tanstack/react-table";

/**
 * Calculate school year string from SchoolYear enum
 * e.g., "next" → "2026-2027" (assuming current date is in 2025-2026 school year)
 */
function getSchoolYearString(schoolYear: SchoolYear): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // School year starts in August (month 7)
  // If we're in Jan-Jul, current school year started previous calendar year
  const schoolYearStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;

  let startYear: number;
  switch (schoolYear) {
    case "previous":
      startYear = schoolYearStartYear - 1;
      break;
    case "current":
      startYear = schoolYearStartYear;
      break;
    case "next":
    default:
      startYear = schoolYearStartYear + 1;
      break;
  }

  return `${startYear}-${startYear + 1}`;
}

const DEFAULT_LIMIT = 50;

/**
 * Parse URL search params to CustomerBidFilters
 */
function parseFiltersFromURL(
  searchParams: URLSearchParams
): CustomerBidFilters {
  return {
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    limit: searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : DEFAULT_LIMIT,
    schoolYear: (searchParams.get("schoolYear") as SchoolYear) || "next",
    siteCode: searchParams.get("siteCode") || undefined,
    customerBillTo: searchParams.get("customerBillTo") || undefined,
    customerName: searchParams.get("customerName") || undefined,
    salesRep: searchParams.get("salesRep") || undefined,
    itemCode: searchParams.get("itemCode") || undefined,
    erpStatus: searchParams.get("erpStatus") || undefined,
    coOpCode: searchParams.get("coOpCode") || undefined,
  };
}

/**
 * Convert filters to URL params (only include non-default values)
 */
function filtersToURLParams(filters: CustomerBidFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.page && filters.page !== 1)
    params.set("page", filters.page.toString());
  if (filters.limit && filters.limit !== DEFAULT_LIMIT)
    params.set("limit", filters.limit.toString());
  // Always include schoolYear in URL for clarity
  if (filters.schoolYear) params.set("schoolYear", filters.schoolYear);
  if (filters.siteCode) params.set("siteCode", filters.siteCode);
  if (filters.customerBillTo)
    params.set("customerBillTo", filters.customerBillTo);
  if (filters.customerName) params.set("customerName", filters.customerName);
  if (filters.salesRep) params.set("salesRep", filters.salesRep);
  if (filters.itemCode) params.set("itemCode", filters.itemCode);
  if (filters.erpStatus) params.set("erpStatus", filters.erpStatus);
  if (filters.coOpCode) params.set("coOpCode", filters.coOpCode);

  return params;
}

export default function CustomerBids() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);

  const [bids, setBids] = useState<CustomerBidDto[]>([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state - initialized from URL params
  const [filters, setFilters] = useState<CustomerBidFilters>(() =>
    parseFiltersFromURL(searchParams)
  );

  // Local filter inputs (before applying) - initialized from URL params
  const [siteCodeInput, setSiteCodeInput] = useState(
    () => searchParams.get("siteCode") || ""
  );
  const [customerBillToInput, setCustomerBillToInput] = useState(
    () => searchParams.get("customerBillTo") || ""
  );
  const [customerNameInput, setCustomerNameInput] = useState(
    () => searchParams.get("customerName") || ""
  );
  const [salesRepInput, setSalesRepInput] = useState(
    () => searchParams.get("salesRep") || ""
  );
  const [itemCodeInput, setItemCodeInput] = useState(
    () => searchParams.get("itemCode") || ""
  );
  const [erpStatusInput, setErpStatusInput] = useState(
    () => searchParams.get("erpStatus") || ""
  );
  const [coOpCodeInput, setCoOpCodeInput] = useState(
    () => searchParams.get("coOpCode") || ""
  );

  // Filter options for datalist autocomplete
  const [filterOptions, setFilterOptions] =
    useState<CustomerBidFilterOptions | null>(null);

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    sourceDb: false,
    customerBillTo: false,
    coOpCode: false,
    contactName: false,
    contactEmail: false,
    contactPhone: false,
  });
  const [tableInstance, setTableInstance] =
    useState<Table<CustomerBidDto> | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);

  const fetchData = useCallback(async (currentFilters: CustomerBidFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCustomerBids(currentFilters);
      setBids(response.data);
      setPagination(response.pagination);
      setDateRange(response.dateRange);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch customer bids";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(filters);
  }, [filters, fetchData]);

  // Fetch filter options when filter sheet is opened
  useEffect(() => {
    if (!filterSheetOpen) return;
    const fetchFilterOptions = async () => {
      try {
        const options = await getCustomerBidFilterOptions();
        setFilterOptions(options);
      } catch {
        // Filter options are a nice-to-have; silently degrade
      }
    };
    void fetchFilterOptions();
  }, [filterSheetOpen]);

  // Sync filters to URL (skip on initial mount to avoid double navigation)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const newParams = filtersToURLParams(filters);
    setSearchParams(newParams, { replace: true });
  }, [filters, setSearchParams]);

  // Sync URL changes back to filters (for browser back/forward)
  useEffect(() => {
    const urlFilters = parseFiltersFromURL(searchParams);
    const currentFiltersStr = JSON.stringify({
      ...filters,
      // Normalize undefined to match URL parsing
      siteCode: filters.siteCode || undefined,
      customerBillTo: filters.customerBillTo || undefined,
      customerName: filters.customerName || undefined,
      salesRep: filters.salesRep || undefined,
      itemCode: filters.itemCode || undefined,
      erpStatus: filters.erpStatus || undefined,
      coOpCode: filters.coOpCode || undefined,
    });
    const urlFiltersStr = JSON.stringify(urlFilters);

    if (urlFiltersStr !== currentFiltersStr) {
      setFilters(urlFilters);
      // Sync local inputs
      setSiteCodeInput(urlFilters.siteCode || "");
      setCustomerBillToInput(urlFilters.customerBillTo || "");
      setCustomerNameInput(urlFilters.customerName || "");
      setSalesRepInput(urlFilters.salesRep || "");
      setItemCodeInput(urlFilters.itemCode || "");
      setErpStatusInput(urlFilters.erpStatus || "");
      setCoOpCodeInput(urlFilters.coOpCode || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Intentionally not including filters to avoid loop

  const handleSearch = () => {
    const newFilters: CustomerBidFilters = {
      page: 1,
      limit: filters.limit,
      schoolYear: filters.schoolYear,
      siteCode: siteCodeInput || undefined,
      customerBillTo: customerBillToInput || undefined,
      customerName: customerNameInput || undefined,
      salesRep: salesRepInput || undefined,
      itemCode: itemCodeInput || undefined,
      erpStatus: erpStatusInput || undefined,
      coOpCode: coOpCodeInput || undefined,
    };
    setFilters(newFilters);
    setFilterSheetOpen(false);
  };

  const handleClearFilters = () => {
    setSiteCodeInput("");
    setCustomerBillToInput("");
    setCustomerNameInput("");
    setSalesRepInput("");
    setItemCodeInput("");
    setErpStatusInput("");
    setCoOpCodeInput("");
    setFilters((prev) => ({
      page: 1,
      limit: prev.limit,
      schoolYear: prev.schoolYear,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setFilters((prev) => ({ ...prev, page: 1, limit: newSize }));
  };

  const hasActiveFilters = Boolean(
    siteCodeInput ||
      customerBillToInput ||
      customerNameInput ||
      salesRepInput ||
      itemCodeInput ||
      erpStatusInput ||
      coOpCodeInput
  );

  const activeFilterCount = [
    siteCodeInput,
    customerBillToInput,
    customerNameInput,
    salesRepInput,
    itemCodeInput,
    erpStatusInput,
    coOpCodeInput,
  ].filter(Boolean).length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handle cell updates for editable columns
  const handleCellUpdate = useCallback(
    async (bid: CustomerBidDto, updates: UpdateCustomerBidDto) => {
      const schoolYearString = getSchoolYearString(
        filters.schoolYear || "next"
      );
      const key = buildBidKey(bid, schoolYearString);

      try {
        const updated = await updateCustomerBid(key, updates);

        // Update local state with only the editable fields
        // (API returns partial DTO with nulls for non-editable fields)
        setBids((prev) =>
          prev.map((b) =>
            b.sourceDb === bid.sourceDb &&
            b.siteCode === bid.siteCode &&
            b.customerBillTo === bid.customerBillTo &&
            b.itemCode === bid.itemCode
              ? {
                  ...b,
                  confirmed: updated.confirmed,
                  yearAround: updated.yearAround,
                  augustDemand: updated.augustDemand,
                  septemberDemand: updated.septemberDemand,
                  octoberDemand: updated.octoberDemand,
                  // Menu months
                  menuJan: updated.menuJan,
                  menuFeb: updated.menuFeb,
                  menuMar: updated.menuMar,
                  menuApr: updated.menuApr,
                  menuMay: updated.menuMay,
                  menuJun: updated.menuJun,
                  menuJul: updated.menuJul,
                  menuAug: updated.menuAug,
                  menuSep: updated.menuSep,
                  menuOct: updated.menuOct,
                  menuNov: updated.menuNov,
                  menuDec: updated.menuDec,
                }
              : b
          )
        );

        toast.success("Updated successfully");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update";
        toast.error(message);
        throw err; // Re-throw so the cell component can revert
      }
    },
    [filters.schoolYear]
  );

  // Create columns with the cell update handler
  const tableColumns = useMemo(
    () => createColumns({ onCellUpdate: handleCellUpdate }),
    [handleCellUpdate]
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-8 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Back to School
        </h1>
        <p className="text-muted-foreground">
          View and filter customer bid data
          {dateRange && (
            <span className="ml-2">
              ({dateRange.startDate} to {dateRange.endDate})
            </span>
          )}
        </p>
      </div>

      {/* School Year Tabs + Toolbar */}
      <div className="shrink-0 flex items-center gap-3">
        <Tabs
          value={filters.schoolYear || "next"}
          onValueChange={(value) => {
            setFilters((prev) => ({
              ...prev,
              page: 1,
              schoolYear: value as SchoolYear,
            }));
          }}
        >
          <TabsList>
            <TabsTrigger value="previous" className="cursor-pointer">
              Previous Year
            </TabsTrigger>
            <TabsTrigger value="current" className="cursor-pointer">
              Current Year
            </TabsTrigger>
            <TabsTrigger value="next" className="cursor-pointer">
              Next Year
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        {/* Filter Sheet */}
        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="mr-2 h-4 w-4" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="sm:max-w-lg px-8">
            <SheetHeader className="pt-8 pb-10">
              <SheetTitle className="text-xl font-semibold tracking-tight">
                Filter Results
              </SheetTitle>
              <p className="text-muted-foreground mt-2">
                Narrow down results by applying filters below
              </p>
            </SheetHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  Site Code
                </Label>
                <FilterCombobox
                  options={filterOptions?.siteCodes ?? []}
                  value={siteCodeInput}
                  onValueChange={setSiteCodeInput}
                  placeholder="e.g. ATL, DFW, CHI"
                  label="Site Code"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  Co-Op Code
                </Label>
                <FilterCombobox
                  options={filterOptions?.coOpCodes ?? []}
                  value={coOpCodeInput}
                  onValueChange={setCoOpCodeInput}
                  placeholder="e.g. COOP001"
                  label="Co-Op Code"
                />
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="customerBillTo"
                  className="text-sm font-medium text-foreground"
                >
                  Customer Bill To
                </Label>
                <Input
                  id="customerBillTo"
                  placeholder="e.g. CUST001"
                  value={customerBillToInput}
                  onChange={(e) => setCustomerBillToInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
                />
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="customerName"
                  className="text-sm font-medium text-foreground"
                >
                  Customer Name
                </Label>
                <Input
                  id="customerName"
                  placeholder="e.g. School District"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  Sales Representative
                </Label>
                <FilterCombobox
                  options={filterOptions?.salesReps ?? []}
                  value={salesRepInput}
                  onValueChange={setSalesRepInput}
                  placeholder="e.g. JSMITH"
                  label="Sales Representative"
                />
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="itemCode"
                  className="text-sm font-medium text-foreground"
                >
                  Item Code
                </Label>
                <Input
                  id="itemCode"
                  placeholder="e.g. SKU-12345"
                  value={itemCodeInput}
                  onChange={(e) => setItemCodeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">
                  ERP Status
                </Label>
                <FilterCombobox
                  options={filterOptions?.erpStatuses ?? []}
                  value={erpStatusInput}
                  onValueChange={setErpStatusInput}
                  placeholder="e.g. Active, Blocked"
                  label="ERP Status"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-8">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClearFilters}
                disabled={!hasActiveFilters}
              >
                Clear All
              </Button>
              <Button type="button" className="flex-1" onClick={handleSearch}>
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

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
            {tableInstance
              ?.getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize cursor-pointer"
                  checked={column.getIsVisible()}
                  onCheckedChange={(checked) =>
                    column.toggleVisibility(checked)
                  }
                  onSelect={() => {
                    // Re-open menu after it closes
                    setTimeout(() => setColumnsDropdownOpen(true), 0);
                  }}
                >
                  {column.id.replace(/([A-Z])/g, " $1").trim()}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={bids.length === 0 || isLoading}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                exportToCSV(bids, customerBidExportColumns, "customer-bids");
                toast.success("CSV exported successfully");
              }}
            >
              Export CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                exportToSIQCSV(bids, "customer-bids-siq");
                toast.success("SIQ CSV exported successfully");
              }}
            >
              Export SIQ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh button */}
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

      {/* Data Table - no card wrapper */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <DataTable
          columns={tableColumns}
          data={bids}
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
