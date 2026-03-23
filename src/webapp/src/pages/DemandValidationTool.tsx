import CustomerBids from "@/pages/CustomerBids";
import { StatsCards } from "@/pages/customer-bids/stats-cards";

const DEFAULT_COLUMN_VISIBILITY = {
  sourceDb: true,
  customerBillTo: true,
  // Hide individual LY columns (composite lyMonths column is shown instead)
  lyAugust: false,
  lySeptember: false,
  lyOctober: false,
  lyNovember: false,
  lyDecember: false,
  lyJanuary: false,
  lyFebruary: false,
  lyMarch: false,
  lyApril: false,
  lyMay: false,
  lyJune: false,
  lyJuly: false,
  // Hide individual CY columns (YTD Usage computed column is shown instead)
  cyAugust: false,
  cySeptember: false,
  cyOctober: false,
  cyNovember: false,
  cyDecember: false,
  cyJanuary: false,
  cyFebruary: false,
  cyMarch: false,
  cyApril: false,
  cyMay: false,
  cyJune: false,
  cyJuly: false,
};

const ALWAYS_VISIBLE_COLUMNS = ["sourceDb", "customerBillTo"];

export default function DemandValidationTool() {
  return (
    <CustomerBids
      defaultExcludeItemPrefixes="5,6,8"
      defaultColumnVisibility={DEFAULT_COLUMN_VISIBILITY}
      alwaysVisibleColumns={ALWAYS_VISIBLE_COLUMNS}
      headerSlot={(stats) => <StatsCards stats={stats} />}
    />
  );
}
