import type {
  CreateIssueReportDto,
  IssueReportResultDto,
} from "@/contracts/dtos/issue-report.dto";

/**
 * File attachment for Jira uploads
 */
export interface AttachmentFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

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

  /**
   * Attach files to an existing Jira issue
   * Best-effort: failures are logged but do not throw
   * @param issueKey - Jira issue key (e.g., "ATV-123")
   * @param files - Array of file attachments
   */
  attachFiles(issueKey: string, files: AttachmentFile[]): Promise<void>;
}
