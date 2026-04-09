/**
 * Custom hook encapsulating all export queue state and operations:
 * - Local queue (client-side Set of bid keys)
 * - Backend queue summary (for badge counts)
 * - Queue confirmation, SIQ export, dequeue, cancel-export handlers
 */
import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  queueBidExportByIds,
  cancelBidExportByIds,
  clearExportByIds,
  exportAndReturn,
  getQueueSummary,
} from "@/apis/bid-exports";
import { exportToNAVCSV } from "@/utils/export-csv";
import { deriveMenuMonthsFromEstimates } from "@/utils/menu-months";
import type { CustomerBidDto, CustomerBidFilters } from "@/types/customer-bids";
import type { QueueSummary } from "@/types/bid-export";

/** Check if two bids refer to the same record (UUID match) */
export function isSameBid(a: CustomerBidDto, b: CustomerBidDto): boolean {
  return a.id === b.id;
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
  // queuedKeys is a Set of bid UUIDs (was composite-key strings pre-migration)
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set());
  const [showPendingQueue, setShowPendingQueue] = useState(false);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [isConfirmingQueue, setIsConfirmingQueue] = useState(false);
  const [isExportingNAV, setIsExportingNAV] = useState(false);

  // Auto-reset pending queue view when queue becomes empty
  useEffect(() => {
    if (showPendingQueue && queuedKeys.size === 0) {
      setShowPendingQueue(false);
    }
  }, [showPendingQueue, queuedKeys.size]);

  // Client-side filter: hide locally queued items (or show only them)
  const displayedBids = useMemo(() => {
    if (showPendingQueue) {
      return bids.filter((bid) => queuedKeys.has(bid.id));
    }
    if (queuedKeys.size === 0) return bids;
    return bids.filter((bid) => !queuedKeys.has(bid.id));
  }, [bids, queuedKeys, showPendingQueue]);

  const isQueued = useCallback(
    (bid: CustomerBidDto) => queuedKeys.has(bid.id),
    [queuedKeys]
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
  const handleToggleQueue = useCallback((bid: CustomerBidDto) => {
    setQueuedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(bid.id)) {
        next.delete(bid.id);
      } else {
        next.add(bid.id);
      }
      return next;
    });
  }, []);

  const handleQueueAll = useCallback(() => {
    setQueuedKeys((prev) => {
      const next = new Set(prev);
      for (const bid of displayedBids) {
        next.add(bid.id);
      }
      return next;
    });
  }, [displayedBids]);

  const handleRemoveAllQueued = useCallback(() => {
    setQueuedKeys(new Set());
  }, []);

  // --- Backend queue operations ---
  const handleConfirmQueue = useCallback(async () => {
    if (queuedKeys.size === 0) return;

    setIsConfirmingQueue(true);
    try {
      const bidIds = Array.from(queuedKeys);

      const result = await queueBidExportByIds({
        exportType: "NAV",
        bidIds,
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
  }, [queuedKeys, fetchQueueSummary, fetchData, filters]);

  // Export NAV: atomic backend call — marks exported + returns bid data for CSV
  const handleExportNAV = useCallback(async () => {
    setIsExportingNAV(true);
    try {
      const result = await exportAndReturn("NAV");
      if (result.totalExported === 0) {
        toast.info(
          "No items queued for NAV export. Queue items for export first."
        );
        return;
      }
      exportToNAVCSV(
        result.data,
        "customer-bids-nav",
        schoolYearString,
        (bid) => deriveMenuMonthsFromEstimates(bid)
      );
      toast.success(
        `Exported ${result.totalExported} item${result.totalExported !== 1 ? "s" : ""}`
      );
      void fetchQueueSummary();
      void fetchData(filters);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export";
      toast.error(message);
    } finally {
      setIsExportingNAV(false);
    }
  }, [fetchQueueSummary, fetchData, filters, schoolYearString]);

  // Dequeue a single item from the backend export queue
  const handleDequeue = useCallback(
    async (bid: CustomerBidDto) => {
      try {
        await cancelBidExportByIds({ bidIds: [bid.id] });
        setBids((prev) => prev.filter((b) => !isSameBid(b, bid)));
        toast.success("Item removed from export queue");
        void fetchQueueSummary();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to dequeue item";
        toast.error(message);
      }
    },
    [fetchQueueSummary, setBids]
  );

  // Clear export status on a single exported item
  const handleCancelExport = useCallback(
    async (bid: CustomerBidDto) => {
      try {
        await clearExportByIds([bid.id]);
        setBids((prev) => prev.filter((b) => !isSameBid(b, bid)));
        toast.success("Export status cleared");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to clear export status";
        toast.error(message);
      }
    },
    [setBids]
  );

  return {
    // State
    queuedKeys,
    showPendingQueue,
    setShowPendingQueue,
    isConfirmingQueue,
    isExportingNAV,
    queueSummary,
    // Computed
    displayedBids,
    // Queries
    isQueued,
    // Local queue
    handleToggleQueue,
    handleQueueAll,
    handleRemoveAllQueued,
    // Backend queue
    handleConfirmQueue,
    handleExportNAV,
    handleDequeue,
    handleCancelExport,
    fetchQueueSummary,
  };
}
