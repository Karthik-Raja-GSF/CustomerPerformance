import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shadcn/components/card";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import { Progress } from "@/shadcn/components/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/dialog";
import {
  uploadSiqFileWithProgress,
  getImportHistory,
  type ImportLog,
  type ImportResult,
  type ImportProgress,
} from "@/apis/siq-import";

/**
 * Required columns for SIQ Import validation
 */
const REQUIRED_COLUMNS = [
  // Site & Supplier (required)
  "Column1.SiteCode",
  "Column1.Company",
  "Column1.ItemCode",
  "Column1.ItemDescription",

  // Optional but expected columns
  "Column1.PrimarySupplierCode",
  "Column1.PrimarySupplierName",
  "Column1.Category Class",
  "Column1.Zone",
  "Column1.Erp Item Status",
  "Column1.ABC Class",
  "Column1.Shelf Life",
  "Column1.Active Planning LT",
  "Column1.Conditional Status",
  "Column1.Challange Status",

  // Inventory columns
  "Column1.On Hand Quantity",
  "Column1.Safety Stock",
  "Column1.On Order",
  "Column1.Open Sales",
  "Column1.Target Stock",
  "Column1.Preferred Max",
  "Column1.Max Stock",
  "Column1.Weeks Supply Onhand",

  // Sales Actuals
  "Column1.Month -3 Actuals",
  "Column1.Month -2 Actuals",
  "Column1.Last Month Actuals",
  "Column1.Current Month Sales",
  "Column1.Last SY Actuals (Aug - May)",
  "Column1.Current SY Actuals (Aug - May)",

  // Forecasts
  "Column1.Current Month Forecast",
  "Column1.Month +1 Forecast",
  "Column1.Month +2 Forecast",
  "Column1.Month +3 Forecast",
  "Column1.Month +4 Forecast",
  "Column1.Forecast Variance MTD",
  "Column1.Supply Variance",

  // Customer Metrics
  "Column1.Total Customers",
  "Column1.Top 5 Customer Ship-To's",
  "Column1.Buyer",
];

interface ValidationResult {
  valid: boolean;
  rowCount: number;
  foundColumns: string[];
  missingColumns: string[];
}

/**
 * Validate Excel file columns on the frontend
 */
async function validateExcelFile(file: File): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          reject(new Error("Excel file contains no sheets"));
          return;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          reject(new Error("Failed to read sheet from Excel file"));
          return;
        }

        // Get all rows to count and extract headers
        const rows = XLSX.utils.sheet_to_json(sheet);
        const firstRow = rows[0];
        const headers = firstRow ? Object.keys(firstRow) : [];

        const missingColumns = REQUIRED_COLUMNS.filter(
          (col) => !headers.includes(col)
        );

        resolve({
          valid: missingColumns.length === 0,
          rowCount: rows.length,
          foundColumns: headers,
          missingColumns,
        });
      } catch {
        reject(new Error("Failed to parse Excel file"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function SiqImport() {
  const [history, setHistory] = useState<ImportLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getImportHistory(20);
      setHistory(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch history"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  /**
   * Validate file and show confirmation modal
   */
  const handleFileValidate = async (file: File) => {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    setIsValidating(true);
    setPendingFile(file);
    setValidationResult(null);

    try {
      const result = await validateExcelFile(file);
      setValidationResult(result);
      setShowConfirmModal(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to validate file"
      );
      setPendingFile(null);
    } finally {
      setIsValidating(false);
    }
  };

  /**
   * Confirm and start the upload
   */
  const handleConfirmUpload = async () => {
    if (!pendingFile) return;

    setShowConfirmModal(false);
    setIsUploading(true);
    setLastResult(null);
    // Set initial progress immediately to show feedback before SSE events arrive
    setProgress({
      type: "validation",
      phase: "validating",
      current: 0,
      total: 100,
      percentage: 0,
      message: "Starting upload...",
    });

    try {
      const result = await uploadSiqFileWithProgress(
        pendingFile,
        undefined,
        (progressUpdate) => {
          setProgress(progressUpdate);

          // Handle validation errors immediately
          if (progressUpdate.type === "error" && progressUpdate.message) {
            toast.error(progressUpdate.message);
          }
        }
      );

      setLastResult(result);
      setProgress(null);

      if (result.status === "COMPLETED") {
        toast.success(
          `Import completed! ${result.stats.rowsProcessed} rows processed.`
        );
      } else {
        toast.error("Import failed. Check the details below.");
      }

      await fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      setValidationResult(null);
    }
  };

  /**
   * Cancel the upload
   */
  const handleCancelUpload = () => {
    setShowConfirmModal(false);
    setPendingFile(null);
    setValidationResult(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileValidate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileValidate(file);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: ImportLog["status"]) => {
    switch (status) {
      case "COMPLETED":
        return <Badge variant="default">Completed</Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="secondary">In Progress</Badge>;
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold md:text-2xl">SIQ Data Import</h1>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left Column - Upload */}
        <div className="flex w-[40%] flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Excel File</CardTitle>
              <CardDescription>
                Upload SIQ Forecast Analysis Excel file (.xlsx or .xls)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                } ${isUploading || isValidating ? "opacity-50 pointer-events-none" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
                <div className="flex flex-col items-center gap-2">
                  {isValidating ? (
                    <>
                      <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
                      <p className="text-sm font-medium">Validating file...</p>
                      <p className="text-xs text-muted-foreground">
                        Checking columns and counting rows
                      </p>
                    </>
                  ) : isUploading && progress ? (
                    <>
                      <div className="w-full max-w-xs">
                        <Progress value={progress.percentage} className="h-2" />
                      </div>
                      <p className="text-sm font-medium">
                        {progress.phase === "validating" &&
                          "Validating columns..."}
                        {progress.phase === "processing" &&
                          `Processing: ${progress.percentage}%`}
                      </p>
                      {progress.message && (
                        <p className="text-xs text-muted-foreground">
                          {progress.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {progress.current} of {progress.total} rows
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-10 w-10 text-muted-foreground"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Excel files up to 50MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Import Result */}
          {lastResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Last Import Result
                  {lastResult.status === "COMPLETED" ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Rows Processed:</div>
                  <div className="font-medium">
                    {lastResult.stats.rowsProcessed}
                  </div>

                  <div>Sites:</div>
                  <div className="font-medium">
                    {lastResult.stats.sitesCreated} created,{" "}
                    {lastResult.stats.sitesUpdated} updated
                  </div>

                  <div>Suppliers:</div>
                  <div className="font-medium">
                    {lastResult.stats.suppliersCreated} created,{" "}
                    {lastResult.stats.suppliersUpdated} updated
                  </div>

                  <div>Items:</div>
                  <div className="font-medium">
                    {lastResult.stats.itemsCreated} created,{" "}
                    {lastResult.stats.itemsUpdated} updated
                  </div>

                  <div>Inventory Snapshots:</div>
                  <div className="font-medium">
                    {lastResult.stats.inventorySnapshotsCreated} created
                  </div>

                  <div>Sales Actuals:</div>
                  <div className="font-medium">
                    {lastResult.stats.salesActualsCreated} created,{" "}
                    {lastResult.stats.salesActualsUpdated} updated
                  </div>

                  <div>Forecasts:</div>
                  <div className="font-medium">
                    {lastResult.stats.forecastsCreated} created,{" "}
                    {lastResult.stats.forecastsUpdated} updated
                  </div>

                  <div>Customer Metrics:</div>
                  <div className="font-medium">
                    {lastResult.stats.customerMetricsCreated} created
                  </div>
                </div>

                {lastResult.errors && lastResult.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-destructive mb-2">
                      Errors ({lastResult.errors.length}):
                    </p>
                    <ScrollArea className="h-32 rounded border p-2">
                      {lastResult.errors.map((error, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">
                          {error}
                        </p>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - History */}
        <div className="flex w-[60%] flex-col gap-4">
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Import History</CardTitle>
                <CardDescription>Recent data imports</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchHistory}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <ScrollArea className="h-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : history.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No import history yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {log.fileName}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-right">
                            {log.rowsProcessed ?? "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Import</DialogTitle>
            <DialogDescription>
              Review the file validation results before importing.
            </DialogDescription>
          </DialogHeader>

          {pendingFile && validationResult && (
            <div className="flex flex-col gap-4">
              {/* File Info */}
              <div className="rounded-lg border p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">File:</div>
                  <div className="font-medium truncate">{pendingFile.name}</div>
                  <div className="text-muted-foreground">Size:</div>
                  <div className="font-medium">
                    {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div className="text-muted-foreground">Rows:</div>
                  <div className="font-medium">
                    {validationResult.rowCount.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">Columns:</div>
                  <div className="font-medium">
                    {validationResult.foundColumns.length}
                  </div>
                </div>
              </div>

              {/* Validation Status */}
              {validationResult.valid ? (
                <div className="flex items-center gap-2 rounded-lg border p-3 bg-green-50 border-green-200">
                  <svg
                    className="h-5 w-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-sm font-medium text-green-800">
                    All {REQUIRED_COLUMNS.length} required columns found
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg border p-3 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-yellow-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="text-sm font-medium text-yellow-800">
                      {validationResult.missingColumns.length} missing column
                      {validationResult.missingColumns.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <ScrollArea className="h-24">
                    <ul className="text-xs text-yellow-700 space-y-1">
                      {validationResult.missingColumns.map((col, idx) => (
                        <li key={idx}>{col}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                  <p className="text-xs text-yellow-600">
                    You can still proceed, but some data may not be imported.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelUpload}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpload}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
