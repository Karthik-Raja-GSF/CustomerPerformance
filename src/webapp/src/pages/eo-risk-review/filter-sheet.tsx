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
import type { EoFilterOptions } from "@/types/eo-risk-review";

export interface EoFilterInputs {
  location: string;
  itemNo: string;
  sourceDb: string;
}

export const EMPTY_EO_FILTER_INPUTS: EoFilterInputs = {
  location: "",
  itemNo: "",
  sourceDb: "",
};

interface EoFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterInputs: EoFilterInputs;
  setFilterInputs: React.Dispatch<React.SetStateAction<EoFilterInputs>>;
  filterOptions: EoFilterOptions | null;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  onSearch: () => void;
  onClear: () => void;
}

export function EoFilterSheet({
  open,
  onOpenChange,
  filterInputs,
  setFilterInputs,
  filterOptions,
  activeFilterCount,
  hasActiveFilters,
  onSearch,
  onClear,
}: EoFilterSheetProps) {
  const updateField = (key: keyof EoFilterInputs) => (value: string) => {
    setFilterInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
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
              Location
            </Label>
            <FilterCombobox
              options={filterOptions?.locations ?? []}
              value={filterInputs.location}
              onValueChange={updateField("location")}
              placeholder="e.g. DORI, ATL"
              label="Location"
            />
          </div>
          <div className="space-y-3">
            <Label
              htmlFor="eo-itemNo"
              className="text-sm font-medium text-foreground"
            >
              Item No
            </Label>
            <Input
              id="eo-itemNo"
              placeholder="e.g. 12345"
              value={filterInputs.itemNo}
              onChange={(e) => updateField("itemNo")(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-11"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Source Database
            </Label>
            <FilterCombobox
              options={filterOptions?.sourceDbs ?? []}
              value={filterInputs.sourceDb}
              onValueChange={updateField("sourceDb")}
              placeholder="e.g. NAV-PROD"
              label="Source Database"
            />
          </div>
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
