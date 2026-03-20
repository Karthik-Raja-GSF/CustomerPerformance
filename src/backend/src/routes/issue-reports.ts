import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import multer from "multer";
import { container } from "tsyringe";
import { IJiraService, JIRA_SERVICE_TOKEN } from "@/services/IJiraService";
import { authenticate } from "@/middleware/authenticate";
import { validateRequest } from "@/middleware/validate-request";
import { JiraApiError, JiraConfigError } from "@/utils/errors/jira-errors";

const router: IRouter = Router();

// Multer for file attachments (diagnostics + screenshot)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 4, // console-logs, network-logs, page-details, screenshot
  },
});

// Validation schema (text fields from FormData)
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
 * Submit a bug report to Jira with optional file attachments
 */
router.post(
  "/",
  authenticate,
  upload.array("attachments", 4),
  validateRequest(createIssueReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jiraService = container.resolve<IJiraService>(JIRA_SERVICE_TOKEN);

      // Step 1: Create the issue
      const result = await jiraService.createIssue({
        ...req.body,
        reporterName: `${req.user!.firstName} ${req.user!.lastName}`,
        reporterEmail: req.user!.email,
      });

      // Step 2: Attach diagnostic files (best-effort)
      const files = req.files as Express.Multer.File[] | undefined;
      if (files && files.length > 0) {
        await jiraService.attachFiles(result.issueKey, files);
      }

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
