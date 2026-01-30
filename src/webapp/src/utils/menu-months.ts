/**
 * Menu Months Utilities
 * Helper functions for working with month selection fields
 */

export const MENU_MONTHS = [
  { key: "menuJan", label: "Jan", full: "January" },
  { key: "menuFeb", label: "Feb", full: "February" },
  { key: "menuMar", label: "Mar", full: "March" },
  { key: "menuApr", label: "Apr", full: "April" },
  { key: "menuMay", label: "May", full: "May" },
  { key: "menuJun", label: "Jun", full: "June" },
  { key: "menuJul", label: "Jul", full: "July" },
  { key: "menuAug", label: "Aug", full: "August" },
  { key: "menuSep", label: "Sep", full: "September" },
  { key: "menuOct", label: "Oct", full: "October" },
  { key: "menuNov", label: "Nov", full: "November" },
  { key: "menuDec", label: "Dec", full: "December" },
] as const;

export type MonthKey = (typeof MENU_MONTHS)[number]["key"];

/**
 * Extract month values from a data object containing month boolean fields
 */
export function getMonthValues(
  data: Partial<Record<MonthKey, boolean | null>>
): Record<MonthKey, boolean> {
  return MENU_MONTHS.reduce(
    (acc, month) => {
      acc[month.key] = data[month.key] === true;
      return acc;
    },
    {} as Record<MonthKey, boolean>
  );
}

/**
 * Format selected months for display
 * Returns compact display string like "Aug, Sep, Oct" or "All" or "-"
 */
export function formatMonthsDisplay(
  data: Partial<Record<MonthKey, boolean | null>>
): string {
  const selected = MENU_MONTHS.filter((m) => data[m.key] === true);

  if (selected.length === 0) return "Select Month";
  if (selected.length === 12) return "All";
  if (selected.length <= 4) {
    return selected.map((m) => m.label).join(", ");
  }
  return `${selected.length} months`;
}

/**
 * Count selected months
 */
export function countSelectedMonths(
  data: Partial<Record<MonthKey, boolean | null>>
): number {
  return MENU_MONTHS.filter((m) => data[m.key] === true).length;
}
