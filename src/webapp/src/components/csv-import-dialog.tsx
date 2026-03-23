/**
 * CSV Import Dialog for Customer Bids
 *
 * Multi-step dialog: upload → preview → uploading → results
 * Parses exported CSV files, validates data, and sends to bulk-update API.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shadcn/components/dialog";
import { Button } from "@/shadcn/components/button";
import { Progress } from "@/shadcn/components/progress";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import { Badge } from "@/shadcn/components/badge";
import {
  bulkUpdateCustomerBids,
  previewBulkUpdateBids,
} from "@/apis/customer-bids";
import { parseImportFile, type ParsedImportResult } from "@/utils/import-csv";
import type { BulkUpdateResultDto } from "@/types/customer-bids";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "upload" | "preview" | "uploading" | "results";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CSVImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: CSVImportDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParsedImportResult | null>(
    null
  );
  const [isParsing, setIsParsing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [changedKeySet, setChangedKeySet] = useState<Set<string>>(new Set());
  const [unchangedPreviewCount, setUnchangedPreviewCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [uploadResults, setUploadResults] =
    useState<BulkUpdateResultDto | null>(null);
  const [serverErrors, setServerErrors] = useState<
    Array<{ key: string; message: string }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setParseResult(null);
    setIsParsing(false);
    setIsChecking(false);
    setChangedKeySet(new Set());
    setUnchangedPreviewCount(0);
    setUploadProgress({ current: 0, total: 0 });
    setUploadResults(null);
    setServerErrors([]);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset();
      onOpenChange(open);
    },
    [onOpenChange, reset]
  );

  // ---- File selection & parsing ----

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);

    try {
      const result = await parseImportFile(selectedFile);
      setParseResult(result);
      setIsParsing(false);

      // Call preview API to identify which records actually changed
      if (result.records.length > 0) {
        setIsChecking(true);
        try {
          const allChangedKeys = new Set<string>();
          let totalUnchanged = 0;

          // Batch preview calls (same BATCH_SIZE as import)
          for (let i = 0; i < result.records.length; i += BATCH_SIZE) {
            const batch = result.records.slice(i, i + BATCH_SIZE);
            const preview = await previewBulkUpdateBids({
              records: batch.map((r) => ({
                ...r.key,
                ...r.updates,
              })),
            });
            for (const key of preview.changedKeys) {
              allChangedKeys.add(key);
            }
            totalUnchanged += preview.unchanged;
          }

          setChangedKeySet(allChangedKeys);
          setUnchangedPreviewCount(totalUnchanged);
        } catch {
          // If preview fails, treat all records as changed (safe fallback)
          const fallbackKeys = new Set(
            result.records.map(
              (r) =>
                `${r.key.sourceDb}/${r.key.siteCode}/${r.key.customerBillTo}/${r.key.itemNo}/${r.key.schoolYear}`
            )
          );
          setChangedKeySet(fallbackKeys);
          setUnchangedPreviewCount(0);
        } finally {
          setIsChecking(false);
        }
      }

      setStep("preview");
    } catch {
      setParseResult({
        records: [],
        errors: [
          {
            row: 0,
            column: "",
            message:
              "Failed to parse file. Ensure it is a valid CSV or Excel file.",
          },
        ],
        totalRows: 0,
        skippedRows: 0,
        duplicateRows: 0,
      });
      setIsParsing(false);
      setStep("preview");
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) void handleFileSelect(selectedFile);
      // Reset so re-selecting the same file triggers onChange again
      e.target.value = "";
    },
    [handleFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) void handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // ---- Derived: only records that actually changed ----

  const changedRecords = useMemo(() => {
    if (!parseResult || changedKeySet.size === 0) return [];
    return parseResult.records.filter((r) => {
      const keyStr = `${r.key.sourceDb}/${r.key.siteCode}/${r.key.customerBillTo}/${r.key.itemNo}/${r.key.schoolYear}`;
      return changedKeySet.has(keyStr);
    });
  }, [parseResult, changedKeySet]);

  // ---- Upload / bulk update ----

  const handleImport = useCallback(async () => {
    if (changedRecords.length === 0) return;

    setStep("uploading");

    const records = changedRecords;
    const batches: (typeof records)[] = [];
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      batches.push(records.slice(i, i + BATCH_SIZE));
    }

    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    const allErrors: Array<{ key: string; message: string }> = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      setUploadProgress({ current: i + 1, total: batches.length });
      try {
        const result = await bulkUpdateCustomerBids({
          records: batch.map((r) => ({
            ...r.key,
            ...r.updates,
          })),
        });
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        totalFailed += result.failed;
        if (result.errors) allErrors.push(...result.errors);
      } catch (err) {
        totalFailed += batch.length;
        allErrors.push({
          key: `Batch ${i + 1}`,
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    }

    setUploadResults({
      updated: totalUpdated,
      skipped: totalSkipped,
      failed: totalFailed,
    });
    setServerErrors(allErrors);
    setStep("results");
  }, [changedRecords]);

  // ---- Done handler ----

  const handleDone = useCallback(() => {
    const updated = uploadResults?.updated ?? 0;
    if (updated > 0) {
      toast.success(
        `Import complete: ${updated} record${updated !== 1 ? "s" : ""} updated`
      );
      onImportComplete();
    }
    handleOpenChange(false);
  }, [uploadResults, onImportComplete, handleOpenChange]);

  // ---- Render helpers ----

  const renderUploadStep = () => (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV or Excel file"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-primary/50"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {isParsing || isChecking ? (
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div className="text-center">
          <p className="font-medium">
            {isParsing
              ? "Parsing file..."
              : isChecking
                ? "Checking for changes..."
                : "Drop a file here or click to browse"}
          </p>
          <p className="text-sm text-muted-foreground">
            Supports CSV and Excel files (.csv, .xlsx, .xls)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          aria-label="Upload CSV or Excel file"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Use the exported CSV as a template. Only editable fields (Year Around,
        Monthly Estimates, Menu Months, Confirmed) will be processed. The School
        Year column is required in the CSV.
      </p>
    </div>
  );

  const renderPreviewStep = () => {
    if (!parseResult) return null;

    const { errors, totalRows, skippedRows, duplicateRows } = parseResult;
    const hasErrors = errors.length > 0;
    const canImport = changedRecords.length > 0;

    return (
      <div className="flex flex-col gap-4">
        {/* File info */}
        <div className="flex items-center gap-2 text-sm">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{file?.name}</span>
          <span className="text-muted-foreground">({totalRows} rows)</span>
        </div>

        {/* Summary stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={canImport ? "default" : "secondary"}>
            {changedRecords.length} record
            {changedRecords.length !== 1 ? "s" : ""} with changes
          </Badge>
          {unchangedPreviewCount > 0 && (
            <Badge variant="secondary">{unchangedPreviewCount} unchanged</Badge>
          )}
          {skippedRows > 0 && (
            <Badge variant="secondary">
              {skippedRows} skipped (no editable fields)
            </Badge>
          )}
          {duplicateRows > 0 && (
            <Badge variant="secondary">
              {duplicateRows} duplicate{duplicateRows !== 1 ? "s" : ""} (latest
              kept)
            </Badge>
          )}
          {hasErrors && (
            <Badge variant="destructive">
              {errors.length} validation error{errors.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        {/* Validation errors */}
        {hasErrors && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">
              Validation Errors
            </p>
            <ScrollArea className="h-40 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err.row > 0 ? `Row ${err.row}` : "File"}
                    {err.column ? `, ${err.column}` : ""}: {err.message}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Preview table */}
        {canImport && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              Preview (first {Math.min(changedRecords.length, 10)} records)
            </p>
            <ScrollArea className="h-48 rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left font-medium">Row</th>
                    <th className="p-2 text-left font-medium">Source</th>
                    <th className="p-2 text-left font-medium">Site Code</th>
                    <th className="p-2 text-left font-medium">
                      Customer Bill To
                    </th>
                    <th className="p-2 text-left font-medium">Item Code</th>
                    <th className="p-2 text-left font-medium">
                      Fields Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changedRecords.slice(0, 10).map((record) => (
                    <tr
                      key={record.rowNumber}
                      className="border-b last:border-0"
                    >
                      <td className="p-2 text-muted-foreground">
                        {record.rowNumber}
                      </td>
                      <td className="p-2">{record.key.sourceDb}</td>
                      <td className="p-2">{record.key.siteCode}</td>
                      <td className="p-2">{record.key.customerBillTo}</td>
                      <td className="p-2">{record.key.itemNo}</td>
                      <td className="p-2">
                        <Badge variant="secondary">
                          {Object.keys(record.updates).length}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  const renderUploadingStep = () => {
    const { current, total } = uploadProgress;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="w-full flex flex-col gap-2">
          <Progress value={percentage} />
          <p className="text-sm text-center text-muted-foreground">
            Uploading batch {current} of {total}...
          </p>
        </div>
      </div>
    );
  };

  const renderResultsStep = () => {
    if (!uploadResults) return null;

    const { updated, skipped, failed } = uploadResults;
    const hasServerErrors = serverErrors.length > 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Success summary */}
        {updated > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="font-medium">
              {updated} record{updated !== 1 ? "s" : ""} updated successfully
            </span>
          </div>
        )}

        {/* Skipped summary */}
        {skipped > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {skipped} record{skipped !== 1 ? "s" : ""} skipped (no changes)
            </span>
          </div>
        )}

        {/* Failure summary */}
        {failed > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="font-medium text-destructive">
              {failed} record{failed !== 1 ? "s" : ""} failed
            </span>
          </div>
        )}

        {/* No updates */}
        {updated === 0 && failed === 0 && skipped === 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">
              No records were updated
            </span>
          </div>
        )}

        {/* Server-side errors */}
        {hasServerErrors && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">
              Error Details
            </p>
            <ScrollArea className="h-40 rounded-md border p-3">
              <div className="flex flex-col gap-1">
                {serverErrors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    <span className="font-medium">{err.key}:</span>{" "}
                    {err.message}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Import CSV"}
            {step === "preview" && "Review Import"}
            {step === "uploading" && "Importing..."}
            {step === "results" && "Import Complete"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "Upload a CSV file to bulk-update customer bid records."}
            {step === "preview" && "Review the parsed data before importing."}
            {step === "uploading" && "Sending updates to the server."}
            {step === "results" && "Review the import results below."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && renderUploadStep()}
        {step === "preview" && renderPreviewStep()}
        {step === "uploading" && renderUploadingStep()}
        {step === "results" && renderResultsStep()}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                <X className="h-4 w-4 mr-2" />
                Start Over
              </Button>
              <Button
                onClick={handleImport}
                disabled={changedRecords.length === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import {changedRecords.length} Record
                {changedRecords.length !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "results" && <Button onClick={handleDone}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
