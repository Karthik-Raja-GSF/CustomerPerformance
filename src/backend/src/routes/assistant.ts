import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { container } from 'tsyringe';
import { IAssistantService, ASSISTANT_SERVICE_TOKEN } from '@/services/IAssistantService';
import { authenticate } from '@/middleware/authenticate';
import { validateRequest } from '@/middleware/validate-request';
import {
  NoActivePromptError,
  UnsupportedModelError,
  BedrockInvocationError,
  McpConnectionError,
} from '@/utils/errors/assistant-errors';

const router: IRouter = Router();

// Validation schemas
const chatRequestSchema = z.object({
  question: z.string().min(1, 'Question is required').max(10000, 'Question too long'),
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
      status: 'error',
      message: error.message,
    });
    return;
  }

  if (error instanceof UnsupportedModelError) {
    res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
    return;
  }

  if (error instanceof BedrockInvocationError) {
    res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
    return;
  }

  if (error instanceof McpConnectionError) {
    res.status(error.statusCode).json({
      status: 'error',
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
  '/chat',
  authenticate,
  validateRequest(chatRequestSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const assistantService = container.resolve<IAssistantService>(ASSISTANT_SERVICE_TOKEN);
      const response = await assistantService.chat(req.body);

      res.json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      handleAssistantError(error, res, next);
    }
  }
);

/**
 * GET /assistant/models
 * Get list of available AI models
 */
router.get(
  '/models',
  authenticate,
  async (_req: Request, res: Response) => {
    const assistantService = container.resolve<IAssistantService>(ASSISTANT_SERVICE_TOKEN);
    const models = assistantService.getAvailableModels();

    res.json({
      status: 'success',
      data: models,
    });
  }
);

export default router;
