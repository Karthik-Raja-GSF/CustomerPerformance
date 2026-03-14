import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import CustomerBids from "@/pages/CustomerBids";
import { StatsCards } from "@/pages/customer-bids/stats-cards";
import { getCustomerBidStats } from "@/apis/customer-bids";
import type {
  CustomerBidFilters,
  CustomerBidStatsDto,
  SchoolYear,
} from "@/types/customer-bids";

/** Build stats filters from URL search params (mirrors CustomerBids filter sync) */
function filtersFromParams(sp: URLSearchParams): CustomerBidFilters {
  const isNew = sp.get("isNew");
  return {
    schoolYear: (sp.get("schoolYear") as SchoolYear) || "next",
    siteCode: sp.get("siteCode") || undefined,
    customerBillTo: sp.get("customerBillTo") || undefined,
    customerName: sp.get("customerName") || undefined,
    salesRep: sp.get("salesRep") || undefined,
    itemCode: sp.get("itemCode") || undefined,
    erpStatus: sp.get("erpStatus") || undefined,
    coOpCode: sp.get("coOpCode") || undefined,
    isNew: isNew === "true" ? true : isNew === "false" ? false : undefined,
    excludeItemPrefixes: sp.get("excludeItemPrefixes") || "5,6,8",
  };
}

const DEFAULT_COLUMN_VISIBILITY = {
  sourceDb: true,
  customerBillTo: true,
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
};

const ALWAYS_VISIBLE_COLUMNS = ["sourceDb", "customerBillTo"];

export default function DemandValidationTool() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<CustomerBidStatsDto | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const filters = filtersFromParams(searchParams);
    getCustomerBidStats(filters)
      .then((data) => {
        if (!controller.signal.aborted) setStats(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStats(null);
      });

    return () => controller.abort();
  }, [searchParams]);

  return (
    <CustomerBids
      defaultExcludeItemPrefixes="5,6,8"
      defaultColumnVisibility={DEFAULT_COLUMN_VISIBILITY}
      alwaysVisibleColumns={ALWAYS_VISIBLE_COLUMNS}
      headerSlot={<StatsCards stats={stats} />}
    />
  );
}
