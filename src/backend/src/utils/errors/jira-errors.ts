/**
 * Jira Error Classes
 *
 * Custom error classes for Jira integration errors.
 */

/**
 * Jira API error (non-200 response)
 */
export class JiraApiError extends Error {
  readonly statusCode = 502;
  readonly apiStatusCode: number | undefined;
  readonly apiErrorMessage: string | undefined;

  constructor(
    message: string = "Jira API request failed",
    apiStatusCode?: number,
    apiErrorMessage?: string
  ) {
    super(message);
    this.name = "JiraApiError";
    this.apiStatusCode = apiStatusCode;
    this.apiErrorMessage = apiErrorMessage;
    Object.setPrototypeOf(this, JiraApiError.prototype);
  }
}

/**
 * Jira configuration error (missing or invalid env vars)
 */
export class JiraConfigError extends Error {
  readonly statusCode = 500;

  constructor(message: string = "Jira configuration is missing or invalid") {
    super(message);
    this.name = "JiraConfigError";
    Object.setPrototypeOf(this, JiraConfigError.prototype);
  }
}
