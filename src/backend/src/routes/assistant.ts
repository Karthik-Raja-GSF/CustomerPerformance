import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  IAssistantService,
  ASSISTANT_SERVICE_TOKEN,
} from "@/services/IAssistantService";
import {
  IChatLogService,
  CHAT_LOG_SERVICE_TOKEN,
} from "@/services/IChatLogService";
import { authenticate } from "@/middleware/authenticate";
import { validateRequest } from "@/middleware/validate-request";
import {
  NoActivePromptError,
  UnsupportedModelError,
  BedrockInvocationError,
  McpConnectionError,
} from "@/utils/errors/assistant-errors";
import {
  ChatLogNotFoundError,
  ChatLogForbiddenError,
} from "@/utils/errors/chat-log-errors";
import { getChatRequests, getChatStreamEvents } from "@/telemetry/metrics";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("assistant");

const router: IRouter = Router();

// Validation schemas
const chatRequestSchema = z.object({
  question: z
    .string()
    .min(1, "Question is required")
    .max(10000, "Question too long"),
});

/**
 * Helper to handle assistant-specific errors
 */
function handleAssistantError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof NoActivePromptError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof UnsupportedModelError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof BedrockInvocationError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  if (error instanceof McpConnectionError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
    return;
  }

  next(error);
}

/**
 * POST /assistant/chat
 * Send a question to the AI assistant
 */
router.post(
  "/chat",
  authenticate,
  validateRequest(chatRequestSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getChatRequests().add(1, { endpoint: "chat" });
      const assistantService = container.resolve<IAssistantService>(
        ASSISTANT_SERVICE_TOKEN
      );
      const response = await assistantService.chat(req.body);

      res.json({
        status: "success",
        data: response,
      });
    } catch (error) {
      handleAssistantError(error, res, next);
    }
  }
);

/**
 * POST /assistant/chat/stream
 * Send a question to the AI assistant with streaming response (SSE)
 */
router.post(
  "/chat/stream",
  authenticate,
  validateRequest(chatRequestSchema, "body"),
  async (req: Request, res: Response, _next: NextFunction) => {
    getChatRequests().add(1, { endpoint: "stream" });
    const startTime = Date.now();
    let fullAnswer = "";

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
    res.flushHeaders(); // Important: flush headers immediately

    // Send initial connection event to keep client alive during processing
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    getChatStreamEvents().add(1, { event_type: "connected" });

    // Track if connection is still alive
    let isConnectionAlive = true;

    // Handle client disconnect - use res.on('close') not req.on('close')
    // req.on('close') fires when request body is fully read, not when client disconnects
    res.on("close", () => {
      isConnectionAlive = false;
    });

    // Keep-alive interval to prevent timeout during long operations
    const keepAliveInterval = setInterval(() => {
      if (isConnectionAlive) {
        res.write(`: keep-alive\n\n`);
      }
    }, 15000); // Send keep-alive every 15 seconds

    try {
      const assistantService = container.resolve<IAssistantService>(
        ASSISTANT_SERVICE_TOKEN
      );
      const chatLogService = container.resolve<IChatLogService>(
        CHAT_LOG_SERVICE_TOKEN
      );

      // Send processing started event
      res.write(`data: ${JSON.stringify({ type: "processing" })}\n\n`);
      getChatStreamEvents().add(1, { event_type: "processing" });

      await assistantService.chatStream(req.body, {
        onChunk: (chunk: string) => {
          fullAnswer += chunk;
          if (isConnectionAlive) {
            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`
            );
            getChatStreamEvents().add(1, { event_type: "chunk" });
          }
        },
        onComplete: (metadata) => {
          clearInterval(keepAliveInterval);

          // Persist chat log and get the ID for feedback, then send SSE complete
          void (async () => {
            const chatLogId = await chatLogService.create({
              userId: req.user!.userId,
              userEmail: req.user!.email,
              question: req.body.question,
              answer: fullAnswer,
              confidence: metadata.confidence,
              confidenceReasoning: metadata.confidenceReasoning,
              accuracy: metadata.accuracy,
              sqlStatus: metadata.sqlStatus,
              rawSql: metadata.rawSql,
              rawResult: metadata.rawResult,
              sqlInputTokens: metadata.usage.sql.inputTokens,
              sqlOutputTokens: metadata.usage.sql.outputTokens,
              answerInputTokens: metadata.usage.answer.inputTokens,
              answerOutputTokens: metadata.usage.answer.outputTokens,
              modelName: metadata.modelName,
              promptId: metadata.promptId,
              responseTimeMs: Date.now() - startTime,
            });

            if (isConnectionAlive) {
              res.write(
                `data: ${JSON.stringify({ type: "complete", metadata: { ...metadata, chatLogId } })}\n\n`
              );
              getChatStreamEvents().add(1, { event_type: "complete" });
              res.end();
            }
          })();
        },
        onError: (error: Error) => {
          clearInterval(keepAliveInterval);
          if (isConnectionAlive) {
            logger.error(
              { event: "stream.error", error: error.message },
              "Stream error"
            );
            res.write(
              `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`
            );
            getChatStreamEvents().add(1, { event_type: "error" });
            res.end();
          }
        },
      });
    } catch (error) {
      clearInterval(keepAliveInterval);
      logger.error(
        {
          event: "stream.error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Stream error"
      );
      if (isConnectionAlive) {
        res.write(
          `data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Unknown error" })}\n\n`
        );
        getChatStreamEvents().add(1, { event_type: "error" });
        res.end();
      }
    }
  }
);

/**
 * PATCH /assistant/chat/:chatLogId/feedback
 * Submit like/dislike feedback on a chat response
 */
const feedbackParamsSchema = z.object({
  chatLogId: z.string().uuid(),
});

const feedbackSchema = z.object({
  feedbackSentiment: z.enum(["like", "dislike"]),
  feedbackReason: z.string().max(2000).optional(),
});

router.patch(
  "/chat/:chatLogId/feedback",
  authenticate,
  validateRequest(feedbackParamsSchema, "params"),
  validateRequest(feedbackSchema, "body"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatLogService = container.resolve<IChatLogService>(
        CHAT_LOG_SERVICE_TOKEN
      );
      const { chatLogId } = req.params as z.infer<typeof feedbackParamsSchema>;
      await chatLogService.updateFeedback(
        chatLogId,
        req.user!.userId,
        req.body
      );
      res.json({ status: "success" });
    } catch (error) {
      if (error instanceof ChatLogNotFoundError) {
        res.status(error.statusCode).json({
          status: "error",
          message: error.message,
        });
        return;
      }
      if (error instanceof ChatLogForbiddenError) {
        res.status(error.statusCode).json({
          status: "error",
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /assistant/models
 * Get list of available AI models
 */
router.get("/models", authenticate, async (_req: Request, res: Response) => {
  const assistantService = container.resolve<IAssistantService>(
    ASSISTANT_SERVICE_TOKEN
  );
  const models = assistantService.getAvailableModels();

  res.json({
    status: "success",
    data: models,
  });
});

export default router;
