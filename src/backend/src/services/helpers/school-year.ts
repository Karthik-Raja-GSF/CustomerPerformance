/**
 * Shared school year boundary utilities.
 *
 * School year definition: July 1, YYYY  →  June 30, YYYY+1 (both inclusive).
 * The year "shifts" on July 1: from Jul 1 onward we are in the new school year.
 *
 * Used by CustomerBidService (sync + list queries) and SchedulerService
 * (self-healing sync check). Both must agree on the same boundaries.
 */

import type { SchoolYear } from "@/contracts/dtos/customer-bid.dto";

/**
 * Determine the start calendar year of the *current* school year.
 * E.g., on 2026-02-28 → returns 2025 (school year 2025-2026).
 *       on 2025-07-01 → returns 2025 (school year 2025-2026).
 *       on 2025-06-30 → returns 2024 (school year 2024-2025).
 */
export function getCurrentSchoolYearStart(): number {
  const now = new Date();
  // getMonth() is 0-indexed: 6 = July
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Get date boundaries for a school year label.
 * Returns startDate (Jul 1) and endDate (Jun 30 next year), both inclusive.
 */
export function getSchoolYearBoundaries(schoolYear: SchoolYear = "next"): {
  startDate: Date;
  endDate: Date;
} {
  const currentStart = getCurrentSchoolYearStart();

  let startYear: number;
  switch (schoolYear) {
    case "previous":
      startYear = currentStart - 1;
      break;
    case "current":
      startYear = currentStart;
      break;
    case "next":
    default:
      startYear = currentStart + 1;
      break;
  }

  return {
    startDate: new Date(startYear, 6, 1), // July 1
    endDate: new Date(startYear + 1, 5, 30), // June 30 next year
  };
}

/**
 * Get the school year display string, e.g. "2025-2026".
 */
export function getSchoolYearString(schoolYear: SchoolYear = "next"): string {
  const { startDate } = getSchoolYearBoundaries(schoolYear);
  return `${startDate.getFullYear()}-${startDate.getFullYear() + 1}`;
}
