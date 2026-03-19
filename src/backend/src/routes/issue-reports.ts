import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import { IJiraService, JIRA_SERVICE_TOKEN } from "@/services/IJiraService";
import { authenticate } from "@/middleware/authenticate";
import { validateRequest } from "@/middleware/validate-request";
import { JiraApiError, JiraConfigError } from "@/utils/errors/jira-errors";

const router: IRouter = Router();

// Validation schema
const createIssueReportSchema = z.object({
  summary: z.string().min(5).max(255),
  description: z.string().min(10).max(5000),
  pageUrl: z.string().url(),
  userAgent: z.string(),
  timestamp: z.string(),
});

/**
 * Helper to handle Jira-specific errors
 */
function handleJiraError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof JiraApiError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
      apiStatusCode: error.apiStatusCode,
      apiErrorMessage: error.apiErrorMessage,
    });
    return;
  }

  if (error instanceof JiraConfigError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  next(error);
}

/**
 * POST /issue-reports
 * Submit a bug report to Jira
 */
router.post(
  "/",
  authenticate,
  validateRequest(createIssueReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jiraService = container.resolve<IJiraService>(JIRA_SERVICE_TOKEN);

      const result = await jiraService.createIssue({
        ...req.body,
        reporterName: `${req.user!.firstName} ${req.user!.lastName}`,
        reporterEmail: req.user!.email,
      });

      res.status(201).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      handleJiraError(error, res, next);
    }
  }
);

export default router;
