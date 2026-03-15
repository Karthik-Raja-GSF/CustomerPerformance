import { useState } from "react";
import { Loader2, Calendar } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { Toggle } from "@/shadcn/components/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shadcn/components/dropdown-menu";
import {
  MENU_MONTHS,
  ESTIMATE_MONTHS,
  formatMonthsDisplay,
  type MonthKey,
} from "@/utils/menu-months";
import type { UpdateCustomerBidDto } from "@/types/customer-bids";

interface EditableMonthsCellProps {
  /** Current menu month selections (from local state, derived from estimates) */
  monthValues: Record<MonthKey, boolean>;
  /** Whether this is a year-around item (disables editing) */
  yearAround: boolean;
  /** Whether editing is disabled (e.g., confirmed bids) */
  disabled?: boolean;
  /** Callback to persist changes via API (clear estimates, set yearAround) */
  onSave: (updates: UpdateCustomerBidDto) => Promise<void>;
  /** Callback to update local menu month state in parent (no API call) */
  onMonthsChange: (months: Record<MonthKey, boolean>) => void;
  /** LY values keyed by estimateKey — used to pre-fill estimates for newly selected months */
  prefillEstimates?: Partial<Record<string, number | null>>;
}

export function EditableMonthsCell({
  monthValues,
  yearAround,
  disabled = false,
  onSave,
  onMonthsChange,
  prefillEstimates = {},
}: EditableMonthsCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localMonths, setLocalMonths] = useState<Record<MonthKey, boolean>>(
    () => ({ ...monthValues })
  );

  // Reset local state when dropdown opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setLocalMonths({ ...monthValues });
    }
    setIsOpen(open);
  };

  const handleToggle = (monthKey: MonthKey) => {
    setLocalMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const handleClearAll = () => {
    setLocalMonths(
      MENU_MONTHS.reduce(
        (acc, m) => {
          acc[m.key] = false;
          return acc;
        },
        {} as Record<MonthKey, boolean>
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const allMonthsSelected = MENU_MONTHS.every(
        (month) => localMonths[month.key] === true
      );

      // Build API updates for months that need data changes
      const updates: UpdateCustomerBidDto = {};
      let hasApiUpdates = false;

      if (allMonthsSelected) {
        // All months selected = Year Around
        updates.yearAround = true;
        hasApiUpdates = true;
      }

      // For months toggled OFF (were ON, now OFF), clear the estimate
      for (const em of ESTIMATE_MONTHS) {
        if (monthValues[em.menuKey] && !localMonths[em.menuKey]) {
          (updates as Record<string, unknown>)[em.estimateKey] = null;
          hasApiUpdates = true;
        }
      }

      // For months toggled ON (were OFF, now ON), prefill with LY value
      for (const em of ESTIMATE_MONTHS) {
        if (!monthValues[em.menuKey] && localMonths[em.menuKey]) {
          const lyValue = prefillEstimates[em.estimateKey];
          if (lyValue != null) {
            (updates as Record<string, unknown>)[em.estimateKey] = lyValue;
            hasApiUpdates = true;
          }
        }
      }

      // Update parent's local state first (shows/hides columns immediately)
      onMonthsChange(localMonths);

      // Then persist data changes if any
      if (hasApiUpdates) {
        await onSave(updates);
      }

      setIsOpen(false);
    } catch {
      // Error is handled by parent (toast shown)
    } finally {
      setIsSaving(false);
    }
  };

  // Show "Year Around" badge when year-around is true
  if (yearAround) {
    return (
      <div className="flex justify-center">
        <Badge variant="secondary">Year Around</Badge>
      </div>
    );
  }

  const displayText = formatMonthsDisplay(monthValues);

  if (disabled) {
    return (
      <div className="flex items-center h-8 px-2 text-sm text-muted-foreground">
        <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
        {displayText}
      </div>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 font-normal cursor-pointer"
        >
          <Calendar className="mr-1 h-3 w-3 text-muted-foreground" />
          {displayText}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3">
        <div className="space-y-3">
          {/* Header with select all / clear all */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Menu Months</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleClearAll}
            >
              None
            </Button>
          </div>

          {/* Month toggles in a 4x3 grid */}
          <div className="grid grid-cols-4 gap-1">
            {MENU_MONTHS.map((month) => (
              <Toggle
                key={month.key}
                variant="outline"
                size="sm"
                pressed={localMonths[month.key]}
                onPressedChange={() => handleToggle(month.key)}
                className="h-8 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                aria-label={month.full}
              >
                {month.label}
              </Toggle>
            ))}
          </div>

          {/* Save button */}
          <Button
            size="sm"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
