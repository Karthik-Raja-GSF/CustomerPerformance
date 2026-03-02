/**
 * Shared school year boundary utilities.
 *
 * School year definition: August 1, YYYY  →  July 31, YYYY+1 (both inclusive).
 * The year "shifts" on August 1: from Aug 1 onward we are in the new school year.
 *
 * Used by CustomerBidService (sync + list queries) and SchedulerService
 * (self-healing sync check). Both must agree on the same boundaries.
 */

import type { SchoolYear } from "@/contracts/dtos/customer-bid.dto";

/**
 * Determine the start calendar year of the *current* school year.
 * E.g., on 2026-02-28 → returns 2025 (school year 2025-2026).
 *       on 2025-08-01 → returns 2025 (school year 2025-2026).
 *       on 2025-07-31 → returns 2024 (school year 2024-2025).
 */
export function getCurrentSchoolYearStart(): number {
  const now = new Date();
  // getMonth() is 0-indexed: 7 = August
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Get date boundaries for a school year label.
 * Returns startDate (Aug 1) and endDate (Jul 31 next year), both inclusive.
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
    startDate: new Date(startYear, 7, 1), // August 1
    endDate: new Date(startYear + 1, 6, 31), // July 31 next year
  };
}

/**
 * Get the school year display string, e.g. "2025-2026".
 */
export function getSchoolYearString(schoolYear: SchoolYear = "next"): string {
  const { startDate } = getSchoolYearBoundaries(schoolYear);
  return `${startDate.getFullYear()}-${startDate.getFullYear() + 1}`;
}
