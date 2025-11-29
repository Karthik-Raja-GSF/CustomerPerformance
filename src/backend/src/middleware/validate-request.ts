import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Middleware factory for validating request data using Zod schemas
 *
 * @param schema - Zod schema to validate against
 * @param part - Which part of the request to validate (body, query, or params)
 * @returns Express middleware function
 *
 * @example
 * router.post('/users', validateRequest(createUserSchema, 'body'), createUser);
 */
export function validateRequest<T>(schema: ZodSchema<T>, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[part];
      const validated = schema.parse(data);

      // Replace the request part with validated data
      req[part] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
