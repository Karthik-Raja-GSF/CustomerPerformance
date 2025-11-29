import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { z } from 'zod';
import { container } from 'tsyringe';
import { IPromptService, PROMPT_SERVICE_TOKEN } from '@/services/IPromptService';
import { authenticate } from '@/middleware/authenticate';
import { validateRequest } from '@/middleware/validate-request';
import {
  PromptNotFoundError,
  CannotDeleteActivePromptError,
} from '@/utils/errors/prompt-errors';

const router: IRouter = Router();

// Validation schemas
const createPromptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Prompt content is required'),
  model: z.string().min(1, 'Model is required'),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid prompt ID format'),
});

// Type for validated params
type IdParams = z.infer<typeof idParamSchema>;

/**
 * Helper to handle prompt-specific errors
 */
function handlePromptError(
  error: unknown,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof PromptNotFoundError) {
    res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
    return;
  }

  if (error instanceof CannotDeleteActivePromptError) {
    res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
    return;
  }

  next(error);
}

/**
 * POST /prompts
 * Create a new prompt (defaults to INACTIVE)
 */
router.post(
  '/',
  authenticate,
  validateRequest(createPromptSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const promptService = container.resolve<IPromptService>(PROMPT_SERVICE_TOKEN);
      const prompt = await promptService.create(req.body);

      res.status(201).json({
        status: 'success',
        data: prompt,
      });
    } catch (error) {
      handlePromptError(error, res, next);
    }
  }
);

/**
 * GET /prompts
 * List all prompts
 */
router.get(
  '/',
  authenticate,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const promptService = container.resolve<IPromptService>(PROMPT_SERVICE_TOKEN);
      const prompts = await promptService.findAll();

      res.json({
        status: 'success',
        data: prompts,
      });
    } catch (error) {
      handlePromptError(error, res, next);
    }
  }
);

/**
 * GET /prompts/:id
 * Get a single prompt by ID
 */
router.get(
  '/:id',
  authenticate,
  validateRequest(idParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const promptService = container.resolve<IPromptService>(PROMPT_SERVICE_TOKEN);
      const prompt = await promptService.findById(id);

      if (!prompt) {
        res.status(404).json({
          status: 'error',
          message: 'Prompt not found',
        });
        return;
      }

      res.json({
        status: 'success',
        data: prompt,
      });
    } catch (error) {
      handlePromptError(error, res, next);
    }
  }
);

/**
 * DELETE /prompts/:id
 * Delete a prompt (fails if prompt is ACTIVE)
 */
router.delete(
  '/:id',
  authenticate,
  validateRequest(idParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const promptService = container.resolve<IPromptService>(PROMPT_SERVICE_TOKEN);
      await promptService.delete(id);

      res.status(204).send();
    } catch (error) {
      handlePromptError(error, res, next);
    }
  }
);

/**
 * PATCH /prompts/:id/activate
 * Set a prompt as active (deactivates all others)
 */
router.patch(
  '/:id/activate',
  authenticate,
  validateRequest(idParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as IdParams;
      const promptService = container.resolve<IPromptService>(PROMPT_SERVICE_TOKEN);
      const prompt = await promptService.setActive(id);

      res.json({
        status: 'success',
        data: prompt,
      });
    } catch (error) {
      handlePromptError(error, res, next);
    }
  }
);

export default router;
