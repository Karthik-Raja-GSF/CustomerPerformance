import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Trash2, Play } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shadcn/components/alert-dialog";
import {
  getSyncHistory,
  getLatestSyncStatus,
  triggerSync,
  getOrphanedRecords,
  deleteOrphanedRecords,
  type SyncLog,
  type SyncStatus,
  type OrphanedRecord,
} from "@/apis/stockiq";

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

export default function StockiqSync() {
  const [history, setHistory] = useState<SyncLog[]>([]);
  const [latestStatus, setLatestStatus] = useState<SyncLog | null>(null);
  const [orphans, setOrphans] = useState<OrphanedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [historyData, statusData, orphansData] = await Promise.all([
        getSyncHistory(20),
        getLatestSyncStatus(),
        getOrphanedRecords(),
      ]);
      setHistory(historyData);
      setLatestStatus(statusData);
      setOrphans(orphansData);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch sync data"
      );
    } finally {
      setIsLoading(false);
    }
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
      const result = await triggerSync();
      toast.success(`Sync started. ID: ${result.syncId.slice(0, 8)}...`);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to trigger sync"
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteOrphans = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteOrphanedRecords();
      toast.success(`Deleted ${result.deletedCount} orphaned records`);
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete orphans"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">StockIQ Sync</h1>
          <p className="text-muted-foreground">
            Manage data synchronization from StockIQ API
          </p>
        </div>
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

      {/* Latest Status Card */}
      {latestStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Sync Status</CardTitle>
            <CardDescription>
              Most recent synchronization details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={latestStatus.status} />
                </div>
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
          </CardContent>
        </Card>
      )}

      {/* Sync History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent synchronization operations</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sync history available
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Triggered By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                    <TableCell>{formatDate(log.startedAt)}</TableCell>
                    <TableCell>{formatRecordCounts(log)}</TableCell>
                    <TableCell>{formatDuration(log.durationMs)}</TableCell>
                    <TableCell className="capitalize">
                      {log.triggeredBy}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Orphaned Records Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Orphaned Records ({orphans.length})</CardTitle>
              <CardDescription>
                Records in database but no longer in StockIQ API
              </CardDescription>
            </div>
            {orphans.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeleting}>
                    {isDeleting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete Orphaned Records?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {orphans.length} orphaned
                      record(s) from the database. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void handleDeleteOrphans()}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {orphans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No orphaned records found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Code</TableHead>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphans.map((orphan) => (
                  <TableRow key={`${orphan.siteCode}-${orphan.itemCode}`}>
                    <TableCell>{orphan.siteCode}</TableCell>
                    <TableCell>{orphan.itemCode}</TableCell>
                    <TableCell>{formatDate(orphan.syncedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
