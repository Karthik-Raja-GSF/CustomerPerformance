/**
 * Menu Months Utilities
 *
 * Menu months are a frontend-only UI concept — they are NOT stored in the database.
 * They control which estimate columns are visible in the table.
 * On page load, menu months are derived from estimates (estimate > 0 → month selected).
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
 * Estimate months mapping - links menu month keys to estimate field keys
 */
export const ESTIMATE_MONTHS = [
  { menuKey: "menuJan", estimateKey: "estimateJan", label: "Jan" },
  { menuKey: "menuFeb", estimateKey: "estimateFeb", label: "Feb" },
  { menuKey: "menuMar", estimateKey: "estimateMar", label: "Mar" },
  { menuKey: "menuApr", estimateKey: "estimateApr", label: "Apr" },
  { menuKey: "menuMay", estimateKey: "estimateMay", label: "May" },
  { menuKey: "menuJun", estimateKey: "estimateJun", label: "Jun" },
  { menuKey: "menuJul", estimateKey: "estimateJul", label: "Jul" },
  { menuKey: "menuAug", estimateKey: "estimateAug", label: "Aug" },
  { menuKey: "menuSep", estimateKey: "estimateSep", label: "Sep" },
  { menuKey: "menuOct", estimateKey: "estimateOct", label: "Oct" },
  { menuKey: "menuNov", estimateKey: "estimateNov", label: "Nov" },
  { menuKey: "menuDec", estimateKey: "estimateDec", label: "Dec" },
] as const;

export type EstimateKey = (typeof ESTIMATE_MONTHS)[number]["estimateKey"];

/**
 * Last Year months mapping - links menu month keys to LY field keys on CustomerBidDto
 */
export const LY_MONTHS = [
  { menuKey: "menuJan", lyKey: "lyJanuary", label: "Jan" },
  { menuKey: "menuFeb", lyKey: "lyFebruary", label: "Feb" },
  { menuKey: "menuMar", lyKey: "lyMarch", label: "Mar" },
  { menuKey: "menuApr", lyKey: "lyApril", label: "Apr" },
  { menuKey: "menuMay", lyKey: "lyMay", label: "May" },
  { menuKey: "menuJun", lyKey: "lyJune", label: "Jun" },
  { menuKey: "menuJul", lyKey: "lyJuly", label: "Jul" },
  { menuKey: "menuAug", lyKey: "lyAugust", label: "Aug" },
  { menuKey: "menuSep", lyKey: "lySeptember", label: "Sep" },
  { menuKey: "menuOct", lyKey: "lyOctober", label: "Oct" },
  { menuKey: "menuNov", lyKey: "lyNovember", label: "Nov" },
  { menuKey: "menuDec", lyKey: "lyDecember", label: "Dec" },
] as const;

export type LyKey = (typeof LY_MONTHS)[number]["lyKey"];

/**
 * Default months to show for Year Around items: Aug, Sep, Oct
 */
export const YEAR_AROUND_ESTIMATE_MONTHS = [
  "menuAug",
  "menuSep",
  "menuOct",
] as const;

/**
 * Derive menu month selections from estimate values.
 * A month is "selected" if its estimate is > 0.
 */
export function deriveMenuMonthsFromEstimates(
  data: Partial<Record<EstimateKey, number | null>>
): Record<MonthKey, boolean> {
  return ESTIMATE_MONTHS.reduce(
    (acc, month) => {
      const estimate = data[month.estimateKey];
      acc[month.menuKey] = estimate != null && estimate > 0;
      return acc;
    },
    {} as Record<MonthKey, boolean>
  );
}

/**
 * Format selected months for display
 * Returns compact display string like "Aug, Sep, Oct" or "All" or "Select Month"
 */
export function formatMonthsDisplay(
  monthValues: Record<MonthKey, boolean>
): string {
  const selected = MENU_MONTHS.filter((m) => monthValues[m.key]);

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
  monthValues: Record<MonthKey, boolean>
): number {
  return MENU_MONTHS.filter((m) => monthValues[m.key]).length;
}
