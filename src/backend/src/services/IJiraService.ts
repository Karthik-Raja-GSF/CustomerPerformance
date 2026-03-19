import type {
  CreateIssueReportDto,
  IssueReportResultDto,
} from "@/contracts/dtos/issue-report.dto";

/**
 * Jira Service Interface
 *
 * Defines the contract for Jira API integration.
 * Handles creating bug issues from user-submitted reports.
 */
export const JIRA_SERVICE_TOKEN = Symbol.for("IJiraService");

export interface IJiraService {
  /**
   * Create a bug issue in Jira
   * @param dto - Issue report data including summary, description, and context
   * @returns Promise resolving to the created issue key and URL
   */
  createIssue(dto: CreateIssueReportDto): Promise<IssueReportResultDto>;
}
