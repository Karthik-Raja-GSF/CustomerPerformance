import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePermissions } from "@/contexts/permissions-context";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  CheckCheck,
  ChevronDown,
  Download,
  Upload,
  Loader2,
  RefreshCw,
  ListPlus,
  ListMinus,
  SendHorizonal,
} from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shadcn/components/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/shadcn/components/tabs";
import {
  getCustomerBids,
  getCustomerBidFilterOptions,
  updateCustomerBid,
  confirmCustomerBid,
  unconfirmCustomerBid,
  bulkUpdateCustomerBids,
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
  deriveMenuMonthsFromEstimates,
  type MonthKey,
} from "@/utils/menu-months";
import {
  DataTable,
  type VisibilityState,
} from "@/pages/customer-bids/data-table";
import { createColumns, canConfirmBid } from "@/pages/customer-bids/columns";
import {
  exportToCSV,
  exportToSIQCSV,
  buildFilteredExportColumns,
} from "@/utils/export-csv";
import { CSVImportDialog } from "@/components/csv-import-dialog";
import { BatchMenuMonthsPopover } from "@/components/batch-menu-months-popover";
import { useExportQueue } from "@/pages/customer-bids/use-export-queue";
import {
  FilterSheet,
  EMPTY_FILTER_INPUTS,
  type FilterInputs,
} from "@/pages/customer-bids/filter-sheet";
import type { Table } from "@tanstack/react-table";
/**
 * Calculate school year string from SchoolYear enum
 * e.g., "next" → "2026-2027" (assuming current date is in 2025-2026 school year)
 */
function getSchoolYearString(schoolYear: SchoolYear): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // School year starts in July (month 6)
  // If we're in Jan-Jun, current school year started previous calendar year
  const schoolYearStartYear = currentMonth >= 6 ? currentYear : currentYear - 1;

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
  searchParams: URLSearchParams,
  defaultConfirmed = false,
  defaultExported?: boolean,
  defaultQueued?: boolean,
  defaultExcludeItemPrefixes?: string
): CustomerBidFilters {
  // Parse confirmed param: "true" -> true, "false" -> false, missing -> use default
  const confirmedParam = searchParams.get("confirmed");
  const confirmed =
    confirmedParam === "true"
      ? true
      : confirmedParam === "false"
        ? false
        : undefined;

  // Parse isNew param
  const isNewParam = searchParams.get("isNew");
  const isNew =
    isNewParam === "true" ? true : isNewParam === "false" ? false : undefined;

  // Parse exported param
  const exportedParam = searchParams.get("exported");
  const exported =
    exportedParam === "true"
      ? true
      : exportedParam === "false"
        ? false
        : undefined;

  // Parse queued param
  const queuedParam = searchParams.get("queued");
  const queued =
    queuedParam === "true" ? true : queuedParam === "false" ? false : undefined;

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
    isNew,
    confirmed: confirmed ?? defaultConfirmed,
    exported: exported ?? defaultExported,
    queued: queued ?? defaultQueued,
    excludeItemPrefixes:
      searchParams.get("excludeItemPrefixes") ||
      defaultExcludeItemPrefixes ||
      undefined,
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
  if (filters.isNew !== undefined) {
    params.set("isNew", filters.isNew.toString());
  }
  // Always include confirmed in URL (false is default, true means showing confirmed only)
  if (filters.confirmed !== undefined) {
    params.set("confirmed", filters.confirmed.toString());
  }
  if (filters.exported !== undefined) {
    params.set("exported", filters.exported.toString());
  }
  if (filters.queued !== undefined) {
    params.set("queued", filters.queued.toString());
  }
  if (filters.excludeItemPrefixes) {
    params.set("excludeItemPrefixes", filters.excludeItemPrefixes);
  }

  return params;
}

interface CustomerBidsProps {
  pageTitle?: string;
  pageDescription?: string;
  defaultConfirmed?: boolean;
  defaultExported?: boolean;
  defaultQueued?: boolean;
  defaultColumnVisibility?: VisibilityState;
  canUnconfirm?: boolean;
  showSIQExport?: boolean;
  showCSVExport?: boolean;
  showCSVImport?: boolean;
  showConfirmedFilter?: boolean;
  showExportedFilter?: boolean;
  showQueueExport?: boolean;
  defaultExcludeItemPrefixes?: string;
  /** Columns that cannot be hidden by the user (always visible in table and export) */
  alwaysVisibleColumns?: string[];
  /** Optional content rendered between the page header and the toolbar */
  headerSlot?: React.ReactNode;
}

export default function CustomerBids({
  pageTitle = "Demand Validation Tool",
  pageDescription = "View and filter customer bid data",
  defaultConfirmed = false,
  defaultExported,
  defaultQueued,
  defaultExcludeItemPrefixes,
  defaultColumnVisibility,
  canUnconfirm = true,
  showSIQExport = false,
  showCSVExport = true,
  showCSVImport = true,
  showConfirmedFilter = true,
  showExportedFilter = false,
  showQueueExport = false,
  alwaysVisibleColumns,
  headerSlot,
}: CustomerBidsProps) {
  const { roles } = usePermissions();
  const isSalesRole =
    roles.some((r) => r.enumKey === "SALES") &&
    !roles.some((r) => r.enumKey === "ADMIN" || r.enumKey === "DEMAND_PLANNER");

  const [searchParams, setSearchParams] = useSearchParams();
  const isInitialMount = useRef(true);
  const isUrlSyncInitMount = useRef(true);

  const [bids, setBids] = useState<CustomerBidDto[]>([]);
  const [pagination, setPagination] = useState<PaginationDto | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state - initialized from URL params
  const [filters, setFilters] = useState<CustomerBidFilters>(() =>
    parseFiltersFromURL(
      searchParams,
      defaultConfirmed,
      defaultExported,
      defaultQueued,
      defaultExcludeItemPrefixes
    )
  );

  // Local filter inputs (before applying) - initialized from URL params
  const [filterInputs, setFilterInputs] = useState<FilterInputs>(() => ({
    siteCode: searchParams.get("siteCode") || "",
    customerBillTo: searchParams.get("customerBillTo") || "",
    customerName: searchParams.get("customerName") || "",
    salesRep: searchParams.get("salesRep") || "",
    itemCode: searchParams.get("itemCode") || "",
    erpStatus: searchParams.get("erpStatus") || "",
    coOpCode: searchParams.get("coOpCode") || "",
    excludeItemPrefixes:
      searchParams.get("excludeItemPrefixes") ||
      defaultExcludeItemPrefixes ||
      "",
  }));
  const [confirmedFilter, setConfirmedFilter] = useState<boolean>(() => {
    const param = searchParams.get("confirmed");
    return param === "true"
      ? true
      : param === "false"
        ? false
        : defaultConfirmed;
  });
  const [isNewFilter, setIsNewFilter] = useState<string>(() => {
    const param = searchParams.get("isNew");
    if (param === "true") return "new";
    if (param === "false") return "renewed";
    return "all";
  });

  const [exportedFilter, setExportedFilter] = useState<boolean | undefined>(
    () => {
      const param = searchParams.get("exported");
      return param === "true"
        ? true
        : param === "false"
          ? false
          : defaultExported;
    }
  );

  const [queuedFilter, setQueuedFilter] = useState<boolean | undefined>(() => {
    const param = searchParams.get("queued");
    return param === "true" ? true : param === "false" ? false : defaultQueued;
  });

  // Filter options for datalist autocomplete
  const [filterOptions, setFilterOptions] =
    useState<CustomerBidFilterOptions | null>(null);

  // Column visibility state
  const alwaysVisibleSet = useMemo(
    () => new Set(alwaysVisibleColumns ?? []),
    [alwaysVisibleColumns]
  );

  const [columnVisibility, setColumnVisibilityRaw] = useState<VisibilityState>({
    sourceDb: false,
    customerBillTo: false,
    coOpCode: false,
    packSize: false,
    contactName: false,
    contactEmail: false,
    contactPhone: false,
    customerLeadTime: false,
    ...defaultColumnVisibility,
  });

  // Wrap setter to enforce always-visible columns
  const setColumnVisibility = useCallback(
    (
      updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)
    ) => {
      setColumnVisibilityRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (alwaysVisibleSet.size === 0) return next;
        const enforced = { ...next };
        for (const col of alwaysVisibleSet) {
          if (enforced[col] === false) enforced[col] = true;
        }
        return enforced;
      });
    },
    [alwaysVisibleSet]
  );
  const [tableInstance, setTableInstance] =
    useState<Table<CustomerBidDto> | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Local menu month overrides — keyed by composite bid key
  // Cleared on full data fetch; updated when user toggles months in the dropdown
  const [menuMonthOverrides, setMenuMonthOverrides] = useState<
    Map<string, Record<MonthKey, boolean>>
  >(new Map());

  const schoolYearString = useMemo(
    () => getSchoolYearString((filters.schoolYear as SchoolYear) || "next"),
    [filters.schoolYear]
  );

  const fetchData = useCallback(async (currentFilters: CustomerBidFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getCustomerBids(currentFilters);
      setBids(response.data);
      setMenuMonthOverrides(new Map());
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

  // Export queue — local queue + backend queue operations
  const {
    queuedKeys,
    showPendingQueue,
    setShowPendingQueue,
    isConfirmingQueue,
    isExportingSIQ,
    queueSummary,
    displayedBids,
    isQueued,
    handleToggleQueue,
    handleQueueAll,
    handleRemoveAllQueued,
    handleConfirmQueue,
    handleExportSIQ,
    handleDequeue,
    handleCancelExport,
  } = useExportQueue({
    bids,
    setBids,
    schoolYearString,
    filters,
    fetchData,
    enabled: showQueueExport,
  });

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
    // Skip initial mount — useState initializer already applied defaults
    if (isUrlSyncInitMount.current) {
      isUrlSyncInitMount.current = false;
      return;
    }
    // Don't pass defaultExported/defaultQueued here: missing URL params
    // should mean "no filter" (All), not fall back to page defaults.
    // Defaults are only applied on initial mount via useState.
    const urlFilters = parseFiltersFromURL(searchParams, defaultConfirmed);
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
      excludeItemPrefixes: filters.excludeItemPrefixes || undefined,
    });
    const urlFiltersStr = JSON.stringify(urlFilters);

    if (urlFiltersStr !== currentFiltersStr) {
      setFilters(urlFilters);
      // Sync local inputs
      setFilterInputs({
        siteCode: urlFilters.siteCode || "",
        customerBillTo: urlFilters.customerBillTo || "",
        customerName: urlFilters.customerName || "",
        salesRep: urlFilters.salesRep || "",
        itemCode: urlFilters.itemCode || "",
        erpStatus: urlFilters.erpStatus || "",
        coOpCode: urlFilters.coOpCode || "",
        excludeItemPrefixes: urlFilters.excludeItemPrefixes || "",
      });
      setExportedFilter(urlFilters.exported);
      setQueuedFilter(urlFilters.queued);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Intentionally not including filters to avoid loop

  const handleSearch = () => {
    const newFilters: CustomerBidFilters = {
      page: 1,
      limit: filters.limit,
      schoolYear: filters.schoolYear,
      siteCode: filterInputs.siteCode || undefined,
      customerBillTo: filterInputs.customerBillTo || undefined,
      customerName: filterInputs.customerName || undefined,
      salesRep: filterInputs.salesRep || undefined,
      itemCode: filterInputs.itemCode || undefined,
      erpStatus: filterInputs.erpStatus || undefined,
      coOpCode: filterInputs.coOpCode || undefined,
      isNew:
        isNewFilter === "renewed"
          ? false
          : isNewFilter === "new"
            ? true
            : undefined,
      confirmed: confirmedFilter,
      exported: exportedFilter,
      queued: queuedFilter,
      excludeItemPrefixes: filterInputs.excludeItemPrefixes || undefined,
    };
    setFilters(newFilters);
    setFilterSheetOpen(false);
  };

  const handleClearFilters = () => {
    setFilterInputs({
      ...EMPTY_FILTER_INPUTS,
      excludeItemPrefixes: defaultExcludeItemPrefixes || "",
    });
    setConfirmedFilter(defaultConfirmed);
    setExportedFilter(defaultExported);
    setQueuedFilter(defaultQueued);
    setIsNewFilter("all");
    setShowPendingQueue(false);
    setFilters((prev) => ({
      page: 1,
      limit: prev.limit,
      schoolYear: prev.schoolYear,
      confirmed: defaultConfirmed,
      exported: defaultExported,
      queued: defaultQueued,
      excludeItemPrefixes: defaultExcludeItemPrefixes || undefined,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newSize: number) => {
    setFilters((prev) => ({ ...prev, page: 1, limit: newSize }));
  };

  const excludePrefixesChanged =
    filterInputs.excludeItemPrefixes !== (defaultExcludeItemPrefixes || "");

  const hasActiveFilters = Boolean(
    filterInputs.siteCode ||
      filterInputs.customerBillTo ||
      filterInputs.customerName ||
      filterInputs.salesRep ||
      filterInputs.itemCode ||
      filterInputs.erpStatus ||
      filterInputs.coOpCode ||
      excludePrefixesChanged ||
      isNewFilter !== "all" ||
      (showConfirmedFilter && confirmedFilter)
  );

  const activeFilterCount = [
    filterInputs.siteCode,
    filterInputs.customerBillTo,
    filterInputs.customerName,
    filterInputs.salesRep,
    filterInputs.itemCode,
    filterInputs.erpStatus,
    filterInputs.coOpCode,
    excludePrefixesChanged,
    isNewFilter !== "all",
    showConfirmedFilter && confirmedFilter,
  ].filter(Boolean).length;

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
                  lastUpdatedAt: updated.lastUpdatedAt,
                  lastUpdatedBy: updated.lastUpdatedBy,
                  confirmedAt: updated.confirmedAt,
                  confirmedBy: updated.confirmedBy,
                  yearAround: updated.yearAround,
                  // Monthly estimates
                  estimateJan: updated.estimateJan,
                  estimateFeb: updated.estimateFeb,
                  estimateMar: updated.estimateMar,
                  estimateApr: updated.estimateApr,
                  estimateMay: updated.estimateMay,
                  estimateJun: updated.estimateJun,
                  estimateJul: updated.estimateJul,
                  estimateAug: updated.estimateAug,
                  estimateSep: updated.estimateSep,
                  estimateOct: updated.estimateOct,
                  estimateNov: updated.estimateNov,
                  estimateDec: updated.estimateDec,
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

  const handleConfirm = useCallback(
    async (bid: CustomerBidDto) => {
      const schoolYearString = getSchoolYearString(
        filters.schoolYear || "next"
      );
      const key = buildBidKey(bid, schoolYearString);

      try {
        await confirmCustomerBid(key);
        setBids((prev) =>
          prev.filter(
            (b) =>
              !(
                b.sourceDb === bid.sourceDb &&
                b.siteCode === bid.siteCode &&
                b.customerBillTo === bid.customerBillTo &&
                b.itemCode === bid.itemCode
              )
          )
        );
        toast.success("Bid confirmed");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to confirm";
        toast.error(message);
        throw err;
      }
    },
    [filters.schoolYear]
  );

  const handleUnconfirm = useCallback(
    async (bid: CustomerBidDto) => {
      const schoolYearString = getSchoolYearString(
        filters.schoolYear || "next"
      );
      const key = buildBidKey(bid, schoolYearString);

      try {
        const updated = await unconfirmCustomerBid(key);
        setBids((prev) =>
          prev.map((b) =>
            b.sourceDb === bid.sourceDb &&
            b.siteCode === bid.siteCode &&
            b.customerBillTo === bid.customerBillTo &&
            b.itemCode === bid.itemCode
              ? {
                  ...b,
                  confirmedAt: updated.confirmedAt,
                  confirmedBy: updated.confirmedBy,
                }
              : b
          )
        );
        toast.success("Confirmation removed");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to unconfirm";
        toast.error(message);
        throw err;
      }
    },
    [filters.schoolYear]
  );

  // Get menu month state for a bid: use override if available, otherwise derive from estimates
  const getMenuMonths = useCallback(
    (bid: CustomerBidDto): Record<MonthKey, boolean> => {
      const key = `${bid.sourceDb}/${bid.siteCode}/${bid.customerBillTo}/${bid.itemCode}`;
      const override = menuMonthOverrides.get(key);
      if (override) return override;
      return deriveMenuMonthsFromEstimates(bid);
    },
    [menuMonthOverrides]
  );

  // Update local menu month state for a bid (frontend-only, no API call)
  const onMenuMonthsChange = useCallback(
    (bid: CustomerBidDto, months: Record<MonthKey, boolean>) => {
      const key = `${bid.sourceDb}/${bid.siteCode}/${bid.customerBillTo}/${bid.itemCode}`;
      setMenuMonthOverrides((prev) => {
        const next = new Map(prev);
        next.set(key, months);
        return next;
      });
    },
    []
  );

  // Batch menu months — eligible bids (skip yearAround items)
  const batchMenuEligibleBids = useMemo(
    () => displayedBids.filter((b) => !b.yearAround),
    [displayedBids]
  );

  // Batch set menu months for all eligible bids (UI-only, no API call)
  const handleBatchMenuMonths = useCallback(
    (months: Record<MonthKey, boolean>) => {
      setMenuMonthOverrides((prev) => {
        const next = new Map(prev);
        for (const bid of batchMenuEligibleBids) {
          const key = `${bid.sourceDb}/${bid.siteCode}/${bid.customerBillTo}/${bid.itemCode}`;
          next.set(key, months);
        }
        return next;
      });
      toast.success(
        `Menu months updated for ${batchMenuEligibleBids.length} record${batchMenuEligibleBids.length !== 1 ? "s" : ""}`
      );
    },
    [batchMenuEligibleBids]
  );

  // Bulk confirm — bids eligible for confirmation on the current page
  const confirmableBids = useMemo(
    () => bids.filter((b) => !b.confirmedAt && canConfirmBid(b)),
    [bids]
  );

  const [isConfirmingAll, setIsConfirmingAll] = useState(false);

  const handleConfirmAll = useCallback(async () => {
    const schoolYearString = getSchoolYearString(filters.schoolYear || "next");
    const records = confirmableBids.map((bid) => ({
      ...buildBidKey(bid, schoolYearString),
      confirmed: true as const,
    }));

    setIsConfirmingAll(true);
    try {
      const result = await bulkUpdateCustomerBids({ records });
      const confirmedKeys = new Set(
        confirmableBids.map(
          (b) => `${b.sourceDb}/${b.siteCode}/${b.customerBillTo}/${b.itemCode}`
        )
      );
      setBids((prev) =>
        prev.filter(
          (b) =>
            !confirmedKeys.has(
              `${b.sourceDb}/${b.siteCode}/${b.customerBillTo}/${b.itemCode}`
            )
        )
      );
      toast.success(
        `${result.updated} bid${result.updated !== 1 ? "s" : ""} confirmed`
      );
      if (result.failed > 0) {
        toast.error(
          `${result.failed} record${result.failed !== 1 ? "s" : ""} failed`
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to confirm bids";
      toast.error(message);
    } finally {
      setIsConfirmingAll(false);
    }
  }, [confirmableBids, filters.schoolYear]);

  // Determine which view mode we're in for column rendering
  const isViewingQueued = queuedFilter === true;
  const isViewingExported = exportedFilter === true;

  // Resolve the per-row action callback and label based on current filter view
  const dequeueHandler = isViewingQueued
    ? handleDequeue
    : isViewingExported
      ? handleCancelExport
      : undefined;
  const dequeueLabel = isViewingQueued ? "Dequeue" : "Cancel";

  // Create columns with the cell update handler
  const tableColumns = useMemo(
    () =>
      createColumns({
        onCellUpdate: handleCellUpdate,
        onConfirm: handleConfirm,
        onUnconfirm: handleUnconfirm,
        canUnconfirm,
        getMenuMonths,
        onMenuMonthsChange,
        isQueued:
          showQueueExport && !isViewingQueued && !isViewingExported
            ? isQueued
            : undefined,
        onToggleQueue:
          showQueueExport && !isViewingQueued && !isViewingExported
            ? handleToggleQueue
            : undefined,
        onDequeue:
          showQueueExport || showExportedFilter ? dequeueHandler : undefined,
        dequeueLabel,
        isSalesRole,
      }),
    [
      handleCellUpdate,
      handleConfirm,
      handleUnconfirm,
      canUnconfirm,
      getMenuMonths,
      onMenuMonthsChange,
      showQueueExport,
      showExportedFilter,
      isViewingQueued,
      isViewingExported,
      isQueued,
      handleToggleQueue,
      dequeueHandler,
      dequeueLabel,
      isSalesRole,
    ]
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
          {dateRange && (
            <Badge variant="secondary" className="text-base px-3 py-1">
              {dateRange.startDate} to {dateRange.endDate}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">{pageDescription}</p>
      </div>

      {headerSlot}

      {/* School Year Tabs + Toolbar */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap">
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
        <FilterSheet
          open={filterSheetOpen}
          onOpenChange={setFilterSheetOpen}
          filterInputs={filterInputs}
          setFilterInputs={setFilterInputs}
          filterOptions={filterOptions}
          activeFilterCount={activeFilterCount}
          hasActiveFilters={hasActiveFilters}
          onSearch={handleSearch}
          onClear={handleClearFilters}
          showConfirmedFilter={showConfirmedFilter}
          confirmedFilter={confirmedFilter}
          onConfirmedFilterChange={setConfirmedFilter}
          isNewFilter={isNewFilter}
          onIsNewFilterChange={setIsNewFilter}
          showExportedFilter={showExportedFilter}
          showPendingQueue={showPendingQueue}
          onShowPendingQueueChange={setShowPendingQueue}
          queuedFilter={queuedFilter}
          onQueuedFilterChange={setQueuedFilter}
          exportedFilter={exportedFilter}
          onExportedFilterChange={setExportedFilter}
          queuedKeysSize={queuedKeys.size}
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
            {tableInstance
              ?.getAllColumns()
              .filter(
                (column) =>
                  column.getCanHide() && !alwaysVisibleSet.has(column.id)
              )
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
                  {column.id === "isNew"
                    ? "Renewed/New"
                    : column.id.replace(/([A-Z])/g, " $1").trim()}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Batch Menu Months */}
        <BatchMenuMonthsPopover
          eligibleCount={batchMenuEligibleBids.length}
          disabled={isLoading || batchMenuEligibleBids.length === 0}
          onApply={handleBatchMenuMonths}
        />

        {/* Export buttons */}
        {showCSVExport && (
          <Button
            variant="outline"
            size="sm"
            disabled={bids.length === 0 || isLoading}
            onClick={() => {
              const exportable = bids.filter(
                (b) =>
                  b.sourceDb && b.siteCode && b.customerBillTo && b.itemCode
              );
              const filteredColumns = buildFilteredExportColumns(
                exportable,
                getMenuMonths,
                columnVisibility
              );
              exportToCSV(exportable, filteredColumns, "customer-bids");
              const skipped = bids.length - exportable.length;
              if (skipped > 0) {
                toast.success(
                  `CSV exported (${skipped} record${skipped > 1 ? "s" : ""} skipped — missing key fields)`
                );
              } else {
                toast.success("CSV exported successfully");
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}

        {/* Queue-based SIQ export (Confirmed Bid Items page) */}
        {showQueueExport && (
          <>
            {/* Local queue buttons — hidden when viewing backend-queued or exported items */}
            {!isViewingQueued && !isViewingExported && (
              <>
                {/* Select All — add all visible bids to local queue */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={displayedBids.length === 0 || isLoading}
                  onClick={handleQueueAll}
                >
                  <ListPlus className="h-4 w-4 mr-2" />
                  Select All
                </Button>

                {/* Deselect All — clear local queue */}
                {queuedKeys.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveAllQueued}
                  >
                    <ListMinus className="h-4 w-4 mr-2" />
                    Deselect All
                  </Button>
                )}

                {/* Queue for Export — send local queue to backend */}
                {queuedKeys.size > 0 && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isConfirmingQueue}
                      >
                        {isConfirmingQueue ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <SendHorizonal className="h-4 w-4 mr-2" />
                        )}
                        Queue for Export
                        <Badge
                          variant="secondary"
                          className="ml-2 h-5 min-w-5 px-1.5"
                        >
                          {queuedKeys.size}
                        </Badge>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Queue {queuedKeys.size} item
                          {queuedKeys.size !== 1 ? "s" : ""} for export?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will add {queuedKeys.size} selected item
                          {queuedKeys.size !== 1 ? "s" : ""} to the export
                          queue. Queued items will be picked up by the nightly
                          export run, or you can export manually using
                          &quot;Export SIQ&quot;.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => void handleConfirmQueue()}
                        >
                          Confirm
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}

            {/* Export SIQ — atomic: marks exported + returns data for CSV */}
            <Button
              variant="outline"
              size="sm"
              disabled={
                isExportingSIQ || !queueSummary || queueSummary.siq === 0
              }
              onClick={() => void handleExportSIQ()}
            >
              {isExportingSIQ ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export SIQ
              {queueSummary && queueSummary.siq > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
                  {queueSummary.siq}
                </Badge>
              )}
            </Button>
          </>
        )}

        {/* Legacy SIQ export (non-queue, e.g. Back to School page) */}
        {showSIQExport && !showQueueExport && (
          <Button
            variant="outline"
            size="sm"
            disabled={bids.length === 0 || isLoading}
            onClick={() => {
              exportToSIQCSV(bids, "customer-bids-siq", getMenuMonths);
              toast.success("SIQ CSV exported successfully");
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export SIQ
          </Button>
        )}

        {/* Import button */}
        {showCSVImport && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportDialogOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
        )}

        {/* Confirm All button — only when viewing unconfirmed bids */}
        {!filters.confirmed && confirmableBids.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={isLoading || isConfirmingAll}
              >
                {isConfirmingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 mr-2" />
                )}
                Confirm All ({confirmableBids.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Confirm {confirmableBids.length} record
                  {confirmableBids.length !== 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark {confirmableBids.length} bid record
                  {confirmableBids.length !== 1 ? "s" : ""} as confirmed with
                  your email and the current timestamp.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleConfirmAll()}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

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
          data={displayedBids}
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

      {/* CSV Import Dialog */}
      {showCSVImport && (
        <CSVImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          schoolYear={schoolYearString}
          onImportComplete={() => fetchData(filters)}
        />
      )}
    </div>
  );
}
