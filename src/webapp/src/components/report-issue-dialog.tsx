import { useRef, useState } from "react";
import { Bug, CircleCheck, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { submitIssueReport } from "@/apis/issue-reports";
import { useDiagnostics } from "@/hooks/use-diagnostics";
import { Button } from "@/shadcn/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/dialog";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import { Textarea } from "@/shadcn/components/textarea";

async function captureScreenshot(): Promise<Blob | null> {
  const overlays = document.querySelectorAll("[data-radix-portal]");
  overlays.forEach((el) => {
    (el as HTMLElement).style.visibility = "hidden";
  });
  await new Promise((r) => requestAnimationFrame(r));

  try {
    const domtoimage = await import("dom-to-image-more");
    const blob = await domtoimage.toBlob(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    return blob;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    return null;
  } finally {
    overlays.forEach((el) => {
      (el as HTMLElement).style.visibility = "";
    });
  }
}

export function ReportIssueFab() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [userFiles, setUserFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedIssueKey, setSubmittedIssueKey] = useState<string | null>(
    null
  );
  const { collectDiagnostics } = useDiagnostics();

  const isBusy = isCollecting || isSubmitting;

  const resetForm = () => {
    setSummary("");
    setDescription("");
    setUserFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSubmittedIssueKey(null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    setOpen(isOpen);
  };

  const handleSubmit = async () => {
    if (summary.trim().length < 5) {
      toast.error("Summary must be at least 5 characters");
      return;
    }

    if (description.trim().length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    // Step 1: Collect diagnostics + screenshot
    setIsCollecting(true);
    const diagnostics = collectDiagnostics();
    const screenshot = await captureScreenshot();
    setIsCollecting(false);

    // Step 2: Submit to backend
    setIsSubmitting(true);
    try {
      const result = await submitIssueReport({
        summary: summary.trim(),
        description: description.trim(),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        diagnostics,
        screenshot,
        userFiles,
      });

      setSubmittedIssueKey(result.issueKey);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit report"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonText = isCollecting
    ? "Collecting diagnostics..."
    : isSubmitting
      ? "Submitting..."
      : "Submit Report";

  return (
    <>
      <button
        type="button"
        className="group fixed bottom-6 right-6 z-50 h-12 inline-flex items-center justify-center rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer overflow-hidden transition-all duration-300 ease-in-out px-3.5"
        onClick={() => setOpen(true)}
      >
        <Bug className="h-5 w-5 shrink-0" />
        <span className="max-w-0 overflow-hidden opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-40 group-hover:opacity-100 group-hover:ml-2 whitespace-nowrap text-sm font-medium">
          Report Issue
        </span>
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          {submittedIssueKey ? (
            <>
              <DialogHeader>
                <div className="flex justify-center py-4">
                  <CircleCheck className="h-12 w-12 text-green-500" />
                </div>
                <DialogTitle className="text-center">
                  Thank You for Your Contribution
                </DialogTitle>
                <DialogDescription className="text-center">
                  Your feedback is valuable. Ticket{" "}
                  <span className="font-semibold">{submittedIssueKey}</span> has
                  been created and will be reviewing shortly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => handleClose(false)}>Close</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Report Issue
                </DialogTitle>
                <DialogDescription>
                  Submit a bug report. This will create a ticket in our issue
                  tracker.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="issue-summary">Summary</Label>
                  <Input
                    id="issue-summary"
                    placeholder="Brief description of the issue"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    maxLength={255}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="issue-description">Description</Label>
                  <Textarea
                    id="issue-description"
                    placeholder="Steps to reproduce, expected vs actual behavior..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    rows={5}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="issue-attachments">
                    Attachments{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isBusy}
                    >
                      <Paperclip className="h-4 w-4 mr-1" />
                      Choose files
                    </Button>
                    <input
                      ref={fileInputRef}
                      id="issue-attachments"
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setUserFiles((prev) => [...prev, ...files]);
                      }}
                    />
                  </div>
                  {userFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {userFiles.map((file, i) => (
                        <span
                          key={`${file.name}-${i}`}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted"
                        >
                          {file.name}
                          <button
                            type="button"
                            className="hover:text-destructive cursor-pointer"
                            onClick={() =>
                              setUserFiles((prev) =>
                                prev.filter((_, idx) => idx !== i)
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isBusy}>
                  {buttonText}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
