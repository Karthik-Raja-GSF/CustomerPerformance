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
  formatMonthsDisplay,
  type MonthKey,
} from "@/utils/menu-months";
import type { UpdateCustomerBidDto } from "@/types/customer-bids";

interface EditableMonthsCellProps {
  /** Current month values from the row data */
  data: Partial<Record<MonthKey, boolean | null>>;
  /** Whether this is a year-around item (disables editing) */
  yearAround: boolean;
  /** Callback when months are saved */
  onSave: (updates: UpdateCustomerBidDto) => Promise<void>;
}

export function EditableMonthsCell({
  data,
  yearAround,
  onSave,
}: EditableMonthsCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localMonths, setLocalMonths] = useState<Record<MonthKey, boolean>>(
    () =>
      MENU_MONTHS.reduce(
        (acc, m) => {
          acc[m.key] = data[m.key] === true;
          return acc;
        },
        {} as Record<MonthKey, boolean>
      )
  );

  // Reset local state when dropdown opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      // Reset to current data state when opening
      setLocalMonths(
        MENU_MONTHS.reduce(
          (acc, m) => {
            acc[m.key] = data[m.key] === true;
            return acc;
          },
          {} as Record<MonthKey, boolean>
        )
      );
    }
    setIsOpen(open);
  };

  const handleToggle = (monthKey: MonthKey) => {
    setLocalMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const handleSelectAll = () => {
    setLocalMonths(
      MENU_MONTHS.reduce(
        (acc, m) => {
          acc[m.key] = true;
          return acc;
        },
        {} as Record<MonthKey, boolean>
      )
    );
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
      // Check if all 12 months are selected
      const allMonthsSelected = MENU_MONTHS.every(
        (month) => localMonths[month.key] === true
      );

      let updates: UpdateCustomerBidDto;

      if (allMonthsSelected) {
        // All months selected = Year Around
        // Set yearAround to true and clear all menu months
        updates = { yearAround: true };
        for (const month of MENU_MONTHS) {
          updates[month.key] = false;
        }
      } else {
        // Normal save: just the month values
        updates = {};
        for (const month of MENU_MONTHS) {
          updates[month.key] = localMonths[month.key];
        }
      }

      await onSave(updates);
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

  const displayText = formatMonthsDisplay(data);

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
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleSelectAll}
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleClearAll}
              >
                None
              </Button>
            </div>
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
