import { apiClient } from "@/apis/client";
import type { DiagnosticsData } from "@/hooks/use-diagnostics";

export interface SubmitIssueReportParams {
  summary: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
  diagnostics: DiagnosticsData;
  screenshot: Blob | null;
  userFiles: File[];
}

export interface IssueReportResult {
  issueKey: string;
  issueUrl: string;
}

interface ApiResponse {
  status: string;
  data: IssueReportResult;
}

export async function submitIssueReport(
  params: SubmitIssueReportParams
): Promise<IssueReportResult> {
  const formData = new FormData();

  // Text fields
  formData.append("summary", params.summary);
  formData.append("description", params.description);
  formData.append("pageUrl", params.pageUrl);
  formData.append("userAgent", params.userAgent);
  formData.append("timestamp", params.timestamp);

  // Diagnostic attachments
  formData.append(
    "attachments",
    new Blob([JSON.stringify(params.diagnostics.consoleLogs, null, 2)], {
      type: "application/json",
    }),
    "console-logs.json"
  );
  formData.append(
    "attachments",
    new Blob([JSON.stringify(params.diagnostics.networkLogs, null, 2)], {
      type: "application/json",
    }),
    "network-logs.json"
  );
  formData.append(
    "attachments",
    new Blob([JSON.stringify(params.diagnostics.pageDetails, null, 2)], {
      type: "application/json",
    }),
    "page-details.json"
  );

  if (params.screenshot) {
    formData.append("attachments", params.screenshot, "screenshot.png");
  }

  // User-uploaded files
  for (const file of params.userFiles) {
    formData.append("attachments", file, file.name);
  }

  const response = await apiClient.postFormData<ApiResponse>(
    "/issue-reports",
    formData
  );
  return response.data;
}
