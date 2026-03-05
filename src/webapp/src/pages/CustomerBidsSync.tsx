import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Play } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shadcn/components/select";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import {
  getSyncHistory,
  getLatestSyncStatus,
  triggerSync,
  type SyncLog,
  type SyncStatus,
  type SchoolYear,
} from "@/apis/customer-bids-sync";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRecordCounts(log: SyncLog): string {
  if (log.recordsTotal === null) return "-";
  const parts = [`${log.recordsTotal.toLocaleString()} total`];
  if (log.recordsInserted !== null && log.recordsInserted > 0) {
    parts.push(`${log.recordsInserted.toLocaleString()} new`);
  }
  if (log.recordsUpdated !== null && log.recordsUpdated > 0) {
    parts.push(`${log.recordsUpdated.toLocaleString()} updated`);
  }
  return parts.join(", ");
}

function StatusBadge({ status }: { status: SyncStatus }) {
  const variants: Record<
    SyncStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    COMPLETED: "default",
    FAILED: "destructive",
    IN_PROGRESS: "secondary",
    PENDING: "outline",
  };

  const labels: Record<SyncStatus, string> = {
    COMPLETED: "Completed",
    FAILED: "Failed",
    IN_PROGRESS: "In Progress",
    PENDING: "Pending",
  };

  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function getSchoolYearString(schoolYear: SchoolYear): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  // School year starts in August (month 7)
  const schoolYearStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;

  let startYear: number;
  switch (schoolYear) {
    case "previous":
      startYear = schoolYearStartYear - 1;
      break;
    case "current":
      startYear = schoolYearStartYear;
      break;
    case "next":
    default:
      startYear = schoolYearStartYear + 1;
      break;
  }
  return `${startYear}-${startYear + 1}`;
}

const schoolYearOptions: { value: SchoolYear; label: string }[] = [
  { value: "next", label: `Next School Year (${getSchoolYearString("next")})` },
  {
    value: "current",
    label: `Current School Year (${getSchoolYearString("current")})`,
  },
  {
    value: "previous",
    label: `Previous School Year (${getSchoolYearString("previous")})`,
  },
];

export default function CustomerBidsSync() {
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [latestStatus, setLatestStatus] = useState<SyncLog | null>(null);
  const [selectedYear, setSelectedYear] = useState<SchoolYear>("next");
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = useCallback(() => {
    // Fetch latest status
    setIsLoadingStatus(true);
    getLatestSyncStatus()
      .then(setLatestStatus)
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to fetch sync status"
        )
      )
      .finally(() => setIsLoadingStatus(false));

    // Fetch history
    setIsLoadingHistory(true);
    getSyncHistory(20)
      .then(setHistory)
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to fetch sync history"
        )
      )
      .finally(() => setIsLoadingHistory(false));
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Auto-refresh when sync is in progress
  useEffect(() => {
    if (
      latestStatus?.status === "IN_PROGRESS" ||
      latestStatus?.status === "PENDING"
    ) {
      const interval = setInterval(() => {
        void fetchData();
      }, 5000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [latestStatus?.status, fetchData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await triggerSync(selectedYear);
      toast.success(
        `Sync started for ${result.schoolYear}. ID: ${result.syncId.slice(0, 8)}...`
      );
      fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to trigger sync"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Customer Bids Sync</h1>
          <p className="text-muted-foreground">
            Calculate bid data for customer reconciliation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedYear}
            onValueChange={(value) => setSelectedYear(value as SchoolYear)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select school year" />
            </SelectTrigger>
            <SelectContent>
              {schoolYearOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => void handleSync()}
            disabled={isSyncing || latestStatus?.status === "IN_PROGRESS"}
          >
            {isSyncing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      {/* Latest Status Card */}
      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Latest Sync Status</CardTitle>
          <CardDescription>Most recent synchronization details</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : latestStatus ? (
            <>
              <div className="grid gap-4 md:grid-cols-5">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={latestStatus.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">School Year</p>
                  <p className="mt-1 font-medium">{latestStatus.schoolYear}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="mt-1 font-medium">
                    {formatDate(latestStatus.startedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Records</p>
                  <p className="mt-1 font-medium">
                    {formatRecordCounts(latestStatus)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="mt-1 font-medium">
                    {formatDuration(latestStatus.durationMs)}
                  </p>
                </div>
              </div>
              {latestStatus.errorMessage && (
                <div className="mt-4 rounded-md bg-destructive/10 p-3">
                  <p className="text-sm text-destructive">
                    {latestStatus.errorMessage}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No sync data available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sync History Table */}
      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <CardHeader className="shrink-0">
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent synchronization operations</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sync history available
            </p>
          ) : (
            <ScrollArea className="h-full">
              <div className="px-6 pb-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>School Year</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <StatusBadge status={log.status} />
                        </TableCell>
                        <TableCell>{log.schoolYear}</TableCell>
                        <TableCell>{formatDate(log.startedAt)}</TableCell>
                        <TableCell>{formatRecordCounts(log)}</TableCell>
                        <TableCell>{formatDuration(log.durationMs)}</TableCell>
                        <TableCell className="capitalize">
                          {log.triggeredBy}
                        </TableCell>
                        <TableCell
                          className="max-w-xs truncate"
                          title={log.errorMessage ?? undefined}
                        >
                          {log.errorMessage ? (
                            <span className="text-destructive text-sm">
                              {log.errorMessage}
                            </span>
                          ) : (
                            "-"
                          )}
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
