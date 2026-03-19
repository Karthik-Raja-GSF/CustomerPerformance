import { injectable } from "tsyringe";
import { config } from "@/config/index";
import type { IJiraService } from "@/services/IJiraService";
import type {
  CreateIssueReportDto,
  IssueReportResultDto,
} from "@/contracts/dtos/issue-report.dto";
import { JiraApiError, JiraConfigError } from "@/utils/errors/jira-errors";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("jira");

interface JiraCreateIssueResponse {
  id: string;
  key: string;
  self: string;
}

/**
 * Jira Service Implementation
 *
 * Handles creating bug issues in Jira via REST API v3.
 * Uses Basic Auth with email + API token.
 */
@injectable()
export class JiraService implements IJiraService {
  /**
   * Create a bug issue in Jira
   */
  async createIssue(dto: CreateIssueReportDto): Promise<IssueReportResultDto> {
    this.validateConfig();

    const { baseUrl, projectKey, email, apiToken, timeoutMs } = config.jira;
    const authHeader =
      "Basic " + Buffer.from(`${email}:${apiToken}`).toString("base64");

    const body = {
      fields: {
        project: { key: projectKey },
        issuetype: { name: "Bug" },
        summary: dto.summary,
        description: this.buildAdfDescription(dto),
        labels: ["user-reported", "admin-panel"],
      },
    };

    logger.info(
      { event: "jira.create.start", project: projectKey },
      "Creating Jira issue"
    );

    try {
      const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        logger.error(
          {
            event: "jira.create.failed",
            statusCode: response.status,
            error: errorText,
          },
          "Jira API request failed"
        );
        throw new JiraApiError(
          "Failed to create Jira issue",
          response.status,
          errorText
        );
      }

      const data = (await response.json()) as JiraCreateIssueResponse;

      logger.info(
        { event: "jira.create.success", issueKey: data.key },
        `Jira issue ${data.key} created`
      );

      return {
        issueKey: data.key,
        issueUrl: `${baseUrl}/browse/${data.key}`,
      };
    } catch (error) {
      if (error instanceof JiraApiError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      logger.error(
        { event: "jira.create.error", error: message },
        "Jira request error"
      );
      throw new JiraApiError(`Jira request failed: ${message}`);
    }
  }

  /**
   * Validate that Jira configuration is present
   */
  private validateConfig(): void {
    const { baseUrl, projectKey, email, apiToken } = config.jira;
    if (!baseUrl || !projectKey || !email || !apiToken) {
      throw new JiraConfigError(
        "Jira configuration is incomplete. Required: JIRA_BASE_URL, JIRA_PROJECT_KEY, JIRA_EMAIL, JIRA_API_TOKEN"
      );
    }
  }

  /**
   * Build Atlassian Document Format (ADF) description
   *
   * Jira REST API v3 requires descriptions in ADF format.
   */
  private buildAdfDescription(dto: CreateIssueReportDto) {
    return {
      version: 1,
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Description" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: dto.description }],
        },
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Context" }],
        },
        {
          type: "bulletList",
          content: [
            this.adfListItem(
              `Reporter: ${dto.reporterName} (${dto.reporterEmail})`
            ),
            this.adfListItem(`Page URL: ${dto.pageUrl}`),
            this.adfListItem(`Browser: ${dto.userAgent}`),
            this.adfListItem(`Reported at: ${dto.timestamp}`),
          ],
        },
      ],
    };
  }

  private adfListItem(text: string) {
    return {
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text }],
        },
      ],
    };
  }
}
