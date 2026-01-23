import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import { Badge } from "@/shadcn/components/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shadcn/components/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shadcn/components/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select";
import { getCustomerBids } from "@/apis/customer-bids";
import type {
  CustomerBidDto,
  CustomerBidFilters,
  PaginationDto,
  SchoolYear,
  DateRangeDto,
} from "@/types/customer-bids";
import {
  DataTable,
  type VisibilityState,
} from "@/pages/customer-bids/data-table";
import { columns } from "@/pages/customer-bids/columns";
import type { Table } from "@tanstack/react-table";

const DEFAULT_LIMIT = 50;

export default function CustomerBids() {
  const [bids, setBids] = useState<CustomerBidDto[]>([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<CustomerBidFilters>({
    page: 1,
    limit: DEFAULT_LIMIT,
    schoolYear: "next",
  });

  // Local filter inputs (before applying)
  const [schoolYearInput, setSchoolYearInput] = useState<SchoolYear>("next");
  const [siteCodeInput, setSiteCodeInput] = useState("");
  const [customerBillToInput, setCustomerBillToInput] = useState("");
  const [customerNameInput, setCustomerNameInput] = useState("");
  const [salesRepInput, setSalesRepInput] = useState("");
  const [itemCodeInput, setItemCodeInput] = useState("");
  const [erpStatusInput, setErpStatusInput] = useState("");

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [tableInstance, setTableInstance] =
    useState<Table<CustomerBidDto> | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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

  const handleSearch = () => {
    const newFilters: CustomerBidFilters = {
      page: 1,
      limit: filters.limit,
      schoolYear: schoolYearInput,
      siteCode: siteCodeInput || undefined,
      customerBillTo: customerBillToInput || undefined,
      customerName: customerNameInput || undefined,
      salesRep: salesRepInput || undefined,
      itemCode: itemCodeInput || undefined,
      erpStatus: erpStatusInput || undefined,
    };
    setFilters(newFilters);
    setFilterSheetOpen(false);
  };

  const handleClearFilters = () => {
    setSchoolYearInput("next");
    setSiteCodeInput("");
    setCustomerBillToInput("");
    setCustomerNameInput("");
    setSalesRepInput("");
    setItemCodeInput("");
    setErpStatusInput("");
    setFilters({ page: 1, limit: filters.limit, schoolYear: "next" });
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setFilters((prev) => ({ ...prev, page: 1, limit: newSize }));
  };

  const hasActiveFilters = Boolean(
    schoolYearInput !== "next" ||
      siteCodeInput ||
      customerBillToInput ||
      customerNameInput ||
      salesRepInput ||
      itemCodeInput ||
      erpStatusInput
  );

  const activeFilterCount = [
    schoolYearInput !== "next" ? schoolYearInput : "",
    siteCodeInput,
    customerBillToInput,
    customerNameInput,
    salesRepInput,
    itemCodeInput,
    erpStatusInput,
  ].filter(Boolean).length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

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

      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3">
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
                <Label
                  htmlFor="schoolYear"
                  className="text-sm font-medium text-foreground"
                >
                  School Year
                </Label>
                <Select
                  value={schoolYearInput}
                  onValueChange={(v) => setSchoolYearInput(v as SchoolYear)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previous">Previous Year</SelectItem>
                    <SelectItem value="current">Current Year</SelectItem>
                    <SelectItem value="next">Next Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label
                  htmlFor="siteCode"
                  className="text-sm font-medium text-foreground"
                >
                  Site Code
                </Label>
                <Input
                  id="siteCode"
                  placeholder="e.g. ATL, DFW, CHI"
                  value={siteCodeInput}
                  onChange={(e) => setSiteCodeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
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
                <Label
                  htmlFor="salesRep"
                  className="text-sm font-medium text-foreground"
                >
                  Sales Representative
                </Label>
                <Input
                  id="salesRep"
                  placeholder="e.g. John Smith"
                  value={salesRepInput}
                  onChange={(e) => setSalesRepInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
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
                <Label
                  htmlFor="erpStatus"
                  className="text-sm font-medium text-foreground"
                >
                  ERP Status
                </Label>
                <Input
                  id="erpStatus"
                  placeholder="e.g. Active, Blocked"
                  value={erpStatusInput}
                  onChange={(e) => setErpStatusInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-11"
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {tableInstance
              ?.getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id.replace(/([A-Z])/g, " $1").trim()}
                </DropdownMenuCheckboxItem>
              ))}
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
          columns={columns}
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
