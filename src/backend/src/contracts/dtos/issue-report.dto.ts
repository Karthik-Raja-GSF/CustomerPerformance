/**
 * Issue Report DTOs
 *
 * Data Transfer Objects for the Jira issue reporting feature.
 */

export interface CreateIssueReportDto {
  summary: string;
  description: string;
  pageUrl: string;
  userAgent: string;
  timestamp: string;
  reporterName: string;
  reporterEmail: string;
}

export interface IssueReportResultDto {
  issueKey: string;
  issueUrl: string;
}
