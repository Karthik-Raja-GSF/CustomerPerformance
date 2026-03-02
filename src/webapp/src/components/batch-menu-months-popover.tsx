import { useState } from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Toggle } from "@/shadcn/components/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/components/popover";
import { MENU_MONTHS, type MonthKey } from "@/utils/menu-months";

interface BatchMenuMonthsPopoverProps {
  /** Count of eligible (non-yearAround) bids that will be affected */
  eligibleCount: number;
  /** Whether the trigger button is disabled */
  disabled?: boolean;
  /** Called when user clicks Apply — updates local menu month state for all eligible bids */
  onApply: (months: Record<MonthKey, boolean>) => void;
}

const ALL_FALSE = MENU_MONTHS.reduce(
  (acc, m) => {
    acc[m.key] = false;
    return acc;
  },
  {} as Record<MonthKey, boolean>
);

export function BatchMenuMonthsPopover({
  eligibleCount,
  disabled = false,
  onApply,
}: BatchMenuMonthsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localMonths, setLocalMonths] = useState<Record<MonthKey, boolean>>(
    () => ({ ...ALL_FALSE })
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const handleToggle = (monthKey: MonthKey) => {
    setLocalMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

  const handleClearAll = () => {
    setLocalMonths({ ...ALL_FALSE });
  };

  const handleApply = () => {
    onApply(localMonths);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Calendar className="h-4 w-4 mr-2" />
          Set Menu Months
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          {/* Header */}
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

          {/* Apply button */}
          <Button
            size="sm"
            className="w-full"
            onClick={handleApply}
            disabled={false}
          >
            Apply ({eligibleCount})
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
