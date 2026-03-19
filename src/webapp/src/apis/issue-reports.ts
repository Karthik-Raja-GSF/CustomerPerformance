import { apiClient } from "@/apis/client";

export interface CreateIssueReportPayload {
  summary: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
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
  payload: CreateIssueReportPayload
): Promise<IssueReportResult> {
  const response = await apiClient.post<ApiResponse>("/issue-reports", payload);
  return response.data;
}
