/**
 * Custom hook encapsulating all export queue state and operations:
 * - Local queue (client-side Set of bid keys)
 * - Backend queue summary (for badge counts)
 * - Queue confirmation, SIQ export, dequeue, cancel-export handlers
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  queueBidExportByKeys,
  cancelBidExportByKeys,
  clearExportByKeys,
  exportAndReturn,
  getQueueSummary,
} from "@/apis/bid-exports";
import { exportToSIQCSV } from "@/utils/export-csv";
import type { CustomerBidDto, CustomerBidFilters } from "@/types/customer-bids";
import type { QueueSummary } from "@/types/bid-export";

/** Check if two bids refer to the same record (composite key match) */
export function isSameBid(a: CustomerBidDto, b: CustomerBidDto): boolean {
  return (
    a.sourceDb === b.sourceDb &&
    a.siteCode === b.siteCode &&
    a.customerBillTo === b.customerBillTo &&
    a.itemCode === b.itemCode
  );
}

interface UseExportQueueOptions {
  bids: CustomerBidDto[];
  setBids: React.Dispatch<React.SetStateAction<CustomerBidDto[]>>;
  schoolYearString: string;
  filters: CustomerBidFilters;
  fetchData: (filters: CustomerBidFilters) => Promise<void>;
  enabled: boolean;
}

export function useExportQueue({
  bids,
  setBids,
  schoolYearString,
  filters,
  fetchData,
  enabled,
}: UseExportQueueOptions) {
  // --- State ---
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set());
  const [showPendingQueue, setShowPendingQueue] = useState(false);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [isConfirmingQueue, setIsConfirmingQueue] = useState(false);
  const [isExportingSIQ, setIsExportingSIQ] = useState(false);

  // Auto-reset pending queue view when queue becomes empty
  useEffect(() => {
    if (showPendingQueue && queuedKeys.size === 0) {
      setShowPendingQueue(false);
    }
  }, [showPendingQueue, queuedKeys.size]);

  // --- Helpers ---
  const bidKeyString = useCallback(
    (bid: CustomerBidDto) =>
      `${bid.sourceDb}/${bid.siteCode}/${bid.customerBillTo}/${bid.itemCode}`,
    []
  );

  // Client-side filter: hide locally queued items (or show only them)
  const displayedBids = useMemo(() => {
    if (showPendingQueue) {
      return bids.filter((bid) => queuedKeys.has(bidKeyString(bid)));
    }
    if (queuedKeys.size === 0) return bids;
    return bids.filter((bid) => !queuedKeys.has(bidKeyString(bid)));
  }, [bids, queuedKeys, bidKeyString, showPendingQueue]);

  const isQueued = useCallback(
    (bid: CustomerBidDto) => queuedKeys.has(bidKeyString(bid)),
    [queuedKeys, bidKeyString]
  );

  // --- Queue summary ---
  const fetchQueueSummary = useCallback(async () => {
    if (!enabled) return;
    try {
      const summary = await getQueueSummary();
      setQueueSummary(summary);
    } catch {
      // Queue summary is informational; silently degrade
    }
  }, [enabled]);

  // Fetch on mount
  useEffect(() => {
    void fetchQueueSummary();
  }, [fetchQueueSummary]);

  // --- Local queue operations ---
  const handleToggleQueue = useCallback(
    (bid: CustomerBidDto) => {
      const key = bidKeyString(bid);
      setQueuedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [bidKeyString]
  );

  const handleQueueAll = useCallback(() => {
    setQueuedKeys((prev) => {
      const next = new Set(prev);
      for (const bid of displayedBids) {
        next.add(bidKeyString(bid));
      }
      return next;
    });
  }, [displayedBids, bidKeyString]);

  const handleRemoveAllQueued = useCallback(() => {
    setQueuedKeys(new Set());
  }, []);

  // --- Backend queue operations ---
  const handleConfirmQueue = useCallback(async () => {
    if (queuedKeys.size === 0) return;

    setIsConfirmingQueue(true);
    try {
      const keys = Array.from(queuedKeys).map((keyStr) => {
        const parts = keyStr.split("/");
        return {
          sourceDb: parts[0] ?? "",
          siteCode: parts[1] ?? "",
          customerBillTo: parts[2] ?? "",
          itemNo: parts[3] ?? "",
          schoolYear: schoolYearString,
        };
      });

      const result = await queueBidExportByKeys({
        exportType: "SIQ",
        keys,
      });

      setQueuedKeys(new Set());
      setShowPendingQueue(false);
      toast.success(
        `${result.itemsQueued} item${result.itemsQueued !== 1 ? "s" : ""} queued for export`
      );

      void fetchQueueSummary();
      void fetchData(filters);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to queue items";
      toast.error(message);
    } finally {
      setIsConfirmingQueue(false);
    }
  }, [queuedKeys, schoolYearString, fetchQueueSummary, fetchData, filters]);

  // Export SIQ: atomic backend call — marks exported + returns bid data for CSV
  const handleExportSIQ = useCallback(async () => {
    setIsExportingSIQ(true);
    try {
      const result = await exportAndReturn("SIQ");
      if (result.totalExported === 0) {
        toast.info(
          "No items queued for SIQ export. Queue items for export first."
        );
        return;
      }
      exportToSIQCSV(result.data, "customer-bids-siq");
      toast.success(
        `Exported ${result.totalExported} item${result.totalExported !== 1 ? "s" : ""}`
      );
      void fetchQueueSummary();
      void fetchData(filters);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export";
      toast.error(message);
    } finally {
      setIsExportingSIQ(false);
    }
  }, [fetchQueueSummary, fetchData, filters]);

  // Dequeue a single item from the backend export queue
  const handleDequeue = useCallback(
    async (bid: CustomerBidDto) => {
      const key = {
        sourceDb: bid.sourceDb || "",
        siteCode: bid.siteCode || "",
        customerBillTo: bid.customerBillTo || "",
        itemNo: bid.itemCode,
        schoolYear: schoolYearString,
      };

      try {
        await cancelBidExportByKeys({ keys: [key] });
        setBids((prev) => prev.filter((b) => !isSameBid(b, bid)));
        toast.success("Item removed from export queue");
        void fetchQueueSummary();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to dequeue item";
        toast.error(message);
      }
    },
    [schoolYearString, fetchQueueSummary, setBids]
  );

  // Clear export status on a single exported item
  const handleCancelExport = useCallback(
    async (bid: CustomerBidDto) => {
      const key = {
        sourceDb: bid.sourceDb || "",
        siteCode: bid.siteCode || "",
        customerBillTo: bid.customerBillTo || "",
        itemNo: bid.itemCode,
        schoolYear: schoolYearString,
      };

      try {
        await clearExportByKeys([key]);
        setBids((prev) => prev.filter((b) => !isSameBid(b, bid)));
        toast.success("Export status cleared");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to clear export status";
        toast.error(message);
      }
    },
    [schoolYearString, setBids]
  );

  return {
    // State
    queuedKeys,
    showPendingQueue,
    setShowPendingQueue,
    isConfirmingQueue,
    isExportingSIQ,
    queueSummary,
    // Computed
    displayedBids,
    // Queries
    isQueued,
    bidKeyString,
    // Local queue
    handleToggleQueue,
    handleQueueAll,
    handleRemoveAllQueued,
    // Backend queue
    handleConfirmQueue,
    handleExportSIQ,
    handleDequeue,
    handleCancelExport,
    fetchQueueSummary,
  };
}
