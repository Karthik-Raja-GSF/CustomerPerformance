import { Router, Request, Response, NextFunction, IRouter } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import {
  IAssistantService,
  ASSISTANT_SERVICE_TOKEN,
} from "@/services/IAssistantService";
import { authenticate } from "@/middleware/authenticate";
import { validateRequest } from "@/middleware/validate-request";
import {
  NoActivePromptError,
  UnsupportedModelError,
  BedrockInvocationError,
  McpConnectionError,
} from "@/utils/errors/assistant-errors";
import { getChatRequests, getChatStreamEvents } from "@/telemetry/metrics";

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

      // Send processing started event
      res.write(`data: ${JSON.stringify({ type: "processing" })}\n\n`);
      getChatStreamEvents().add(1, { event_type: "processing" });

      await assistantService.chatStream(req.body, {
        onChunk: (chunk: string) => {
          if (isConnectionAlive) {
            res.write(
              `data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`
            );
            getChatStreamEvents().add(1, { event_type: "chunk" });
          }
        },
        onComplete: (metadata) => {
          clearInterval(keepAliveInterval);
          if (isConnectionAlive) {
            res.write(
              `data: ${JSON.stringify({ type: "complete", metadata })}\n\n`
            );
            getChatStreamEvents().add(1, { event_type: "complete" });
            res.end();
          }
        },
        onError: (error: Error) => {
          clearInterval(keepAliveInterval);
          if (isConnectionAlive) {
            console.error("[Stream] Error:", error.message);
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
      console.error("[Stream] Error:", error);
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
