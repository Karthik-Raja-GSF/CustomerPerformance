/**
 * FilterSheet — extracted from CustomerBids.tsx
 * Renders a slide-out sheet with all filter inputs for the bid data table.
 */
import { Filter } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import { Badge } from "@/shadcn/components/badge";
import { FilterCombobox } from "@/components/filter-combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shadcn/components/sheet";
import { Switch } from "@/shadcn/components/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select";
import type { CustomerBidFilterOptions } from "@/types/customer-bids";

/** Consolidated filter input state (text inputs only) */
export interface FilterInputs {
  siteCode: string;
  customerBillTo: string;
  customerName: string;
  salesRep: string;
  itemCode: string;
  erpStatus: string;
  coOpCode: string;
  excludeItemPrefixes: string;
}

export const EMPTY_FILTER_INPUTS: FilterInputs = {
  siteCode: "",
  customerBillTo: "",
  customerName: "",
  salesRep: "",
  itemCode: "",
  erpStatus: "",
  coOpCode: "",
  excludeItemPrefixes: "",
};

interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterInputs: FilterInputs;
  setFilterInputs: React.Dispatch<React.SetStateAction<FilterInputs>>;
  filterOptions: CustomerBidFilterOptions | null;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onSearch: () => void;
  onClear: () => void;
  // Confirmed filter
  showConfirmedFilter: boolean;
  confirmedFilter: boolean;
  onConfirmedFilterChange: (val: boolean) => void;
  // Lost filter
  isLostFilter: string;
  onIsLostFilterChange: (val: string) => void;
  // Export status filters (optional section)
  showExportedFilter: boolean;
  showPendingQueue: boolean;
  onShowPendingQueueChange: (val: boolean) => void;
  queuedFilter: boolean | undefined;
  onQueuedFilterChange: (val: boolean | undefined) => void;
  exportedFilter: boolean | undefined;
  onExportedFilterChange: (val: boolean | undefined) => void;
  queuedKeysSize: number;
}

export function FilterSheet({
  open,
  onOpenChange,
  filterInputs,
  setFilterInputs,
  filterOptions,
  activeFilterCount,
  hasActiveFilters,
  onSearch,
  onClear,
  showConfirmedFilter,
  confirmedFilter,
  onConfirmedFilterChange,
  isLostFilter,
  onIsLostFilterChange,
  showExportedFilter,
  showPendingQueue,
  onShowPendingQueueChange,
  queuedFilter,
  onQueuedFilterChange,
  exportedFilter,
  onExportedFilterChange,
  queuedKeysSize,
}: FilterSheetProps) {
  const updateField = (key: keyof FilterInputs) => (value: string) => {
    setFilterInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  // Derive the export status select value
  const exportStatusValue = showPendingQueue
    ? "pending-queue"
    : queuedFilter === true
      ? "queued"
      : exportedFilter === true
        ? "exported"
        : exportedFilter === false && queuedFilter === false
          ? "not-exported"
          : "all";

  const handleExportStatusChange = (v: string) => {
    onShowPendingQueueChange(v === "pending-queue");
    switch (v) {
      case "all":
        onExportedFilterChange(undefined);
        onQueuedFilterChange(undefined);
        break;
      case "not-exported":
        onExportedFilterChange(false);
        onQueuedFilterChange(false);
        break;
      case "queued":
        onExportedFilterChange(undefined);
        onQueuedFilterChange(true);
        break;
      case "exported":
        onExportedFilterChange(true);
        onQueuedFilterChange(undefined);
        break;
      case "pending-queue":
        onExportedFilterChange(false);
        onQueuedFilterChange(false);
        break;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
        <div className="space-y-6 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Site Code
            </Label>
            <FilterCombobox
              options={filterOptions?.siteCodes ?? []}
              value={filterInputs.siteCode}
              onValueChange={updateField("siteCode")}
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
              value={filterInputs.coOpCode}
              onValueChange={updateField("coOpCode")}
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
              value={filterInputs.customerBillTo}
              onChange={(e) => updateField("customerBillTo")(e.target.value)}
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
              value={filterInputs.customerName}
              onChange={(e) => updateField("customerName")(e.target.value)}
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
              value={filterInputs.salesRep}
              onValueChange={updateField("salesRep")}
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
              value={filterInputs.itemCode}
              onChange={(e) => updateField("itemCode")(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11"
            />
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="excludeItemPrefixes"
              className="text-sm font-medium text-foreground"
            >
              Exclude Item Prefixes
            </Label>
            <Input
              id="excludeItemPrefixes"
              placeholder="e.g. 6, 8"
              value={filterInputs.excludeItemPrefixes}
              onChange={(e) =>
                updateField("excludeItemPrefixes")(e.target.value)
              }
              onKeyDown={handleKeyDown}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated prefixes to exclude
            </p>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              ERP Status
            </Label>
            <FilterCombobox
              options={filterOptions?.erpStatuses ?? []}
              value={filterInputs.erpStatus}
              onValueChange={updateField("erpStatus")}
              placeholder="e.g. Active, Blocked"
              label="ERP Status"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Renewed/New
            </Label>
            <Select value={isLostFilter} onValueChange={onIsLostFilterChange}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="renewed">Renewed Only</SelectItem>
                <SelectItem value="new">New Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showConfirmedFilter && (
            <div className="flex items-center justify-between py-2">
              <Label
                htmlFor="confirmed-filter"
                className="text-sm font-medium text-foreground"
              >
                Show Confirmed Only
              </Label>
              <Switch
                id="confirmed-filter"
                checked={confirmedFilter}
                onCheckedChange={onConfirmedFilterChange}
              />
            </div>
          )}
          {showExportedFilter && (
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">
                Export Status
              </Label>
              <Select
                value={exportStatusValue}
                onValueChange={handleExportStatusChange}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not-exported">
                    Not Exported & Not Queued
                  </SelectItem>
                  <SelectItem
                    value="pending-queue"
                    disabled={queuedKeysSize === 0}
                  >
                    Selected to be Queued ({queuedKeysSize})
                  </SelectItem>
                  <SelectItem value="queued">Queued for Export</SelectItem>
                  <SelectItem value="exported">Exported</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-8 pb-8">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClear}
            disabled={!hasActiveFilters}
          >
            Clear All
          </Button>
          <Button type="button" className="flex-1" onClick={onSearch}>
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
