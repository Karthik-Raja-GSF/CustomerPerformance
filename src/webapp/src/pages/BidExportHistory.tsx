import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import {
  getBidExportRuns,
  getQueueSummary,
  cancelQueuedExports,
} from "@/apis/bid-exports";
import type {
  BidExportRunDto,
  BidExportRunStatus,
  QueueSummary,
} from "@/types/bid-export";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusBadge({ status }: { status: BidExportRunStatus }) {
  const variants: Record<
    BidExportRunStatus,
    "default" | "secondary" | "destructive"
  > = {
    COMPLETED: "default",
    FAILED: "destructive",
    IN_PROGRESS: "secondary",
  };

  const labels: Record<BidExportRunStatus, string> = {
    COMPLETED: "Completed",
    FAILED: "Failed",
    IN_PROGRESS: "In Progress",
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

export default function BidExportHistory() {
  const [runs, setRuns] = useState<BidExportRunDto[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchData = useCallback(() => {
    setIsLoadingRuns(true);
    getBidExportRuns(20)
      .then(setRuns)
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to fetch export history"
        )
      )
      .finally(() => setIsLoadingRuns(false));

    setIsLoadingSummary(true);
    getQueueSummary()
      .then(setQueueSummary)
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to fetch queue summary"
        )
      )
      .finally(() => setIsLoadingSummary(false));
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCancelQueue = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelQueuedExports();
      toast.success(
        `${result.cancelled} queued item${result.cancelled !== 1 ? "s" : ""} cancelled`
      );
      fetchData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel queue"
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const latestRun = runs.length > 0 ? runs[0] : null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-semibold">Bid Items Export History</h1>
          <p className="text-muted-foreground">
            Track bid export queue and run history
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoadingRuns || isLoadingSummary}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Queue Summary Card */}
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Export Queue</CardTitle>
          <CardDescription>Items currently queued for export</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSummary ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : queueSummary && queueSummary.total > 0 ? (
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">SIQ</p>
                <p className="mt-1 text-2xl font-semibold">
                  {queueSummary.siq.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CSV</p>
                <p className="mt-1 text-2xl font-semibold">
                  {queueSummary.csv.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-semibold">
                  {queueSummary.total.toLocaleString()}
                </p>
              </div>
              <div className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                disabled={isCancelling}
                onClick={() => void handleCancelQueue()}
              >
                {isCancelling ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Cancel All Queued
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No items currently queued
            </p>
          )}
        </CardContent>
      </Card>

      {/* Latest Run Card */}
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Latest Export Run</CardTitle>
          <CardDescription>Most recent export operation</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRuns ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : latestRun ? (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={latestRun.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Export Type</p>
                  <p className="mt-1 font-medium">{latestRun.exportType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="mt-1 font-medium">
                    {formatDate(latestRun.startedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Records</p>
                  <p className="mt-1 font-medium">
                    {latestRun.totalRecords?.toLocaleString() ?? "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="mt-1 font-medium">
                    {formatDuration(latestRun.durationMs)}
                  </p>
                </div>
              </div>
              {latestRun.errorMessage && (
                <div className="mt-4 rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {latestRun.errorMessage}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No export runs yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Run History Table */}
      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>Export Run History</CardTitle>
          <CardDescription>Recent export operations</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
          {isLoadingRuns ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No export history available
            </p>
          ) : (
            <ScrollArea className="h-full">
              <div className="px-6 pb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Export Type</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Triggered By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell>
                          <StatusBadge status={run.status} />
                        </TableCell>
                        <TableCell>{run.exportType}</TableCell>
                        <TableCell>{formatDate(run.startedAt)}</TableCell>
                        <TableCell>
                          {run.totalRecords?.toLocaleString() ?? "-"}
                        </TableCell>
                        <TableCell>{formatDuration(run.durationMs)}</TableCell>
                        <TableCell className="capitalize">
                          {run.triggeredBy}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
