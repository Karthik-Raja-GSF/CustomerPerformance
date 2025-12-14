import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createChildLogger } from "../telemetry/logger";
import { recordException, getTraceId } from "../telemetry/tracer";
import { getHttpErrorsTotal } from "../telemetry/metrics";

const logger = createChildLogger("error-handler");

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;
  const traceId = getTraceId();

  // Record exception in the current span
  recordException(err);

  // Record error metric
  const httpErrorsTotal = getHttpErrorsTotal();
  httpErrorsTotal.add(1, {
    method: req.method,
    route: req.route?.path || req.path,
    status_code: String(statusCode),
    error_type: err.name || "Error",
  });

  // Log error with context
  logger.error(
    {
      event: "error.handler",
      requestId: req.requestId,
      traceId,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
        statusCode,
        isOperational,
      },
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
    },
    `Error: ${err.message}`
  );

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Validation error",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
      ...(traceId && { traceId }),
    });
    return;
  }

  // Handle known operational errors
  if (isOperational) {
    res.status(statusCode).json({
      status: "error",
      message: err.message,
      ...(traceId && { traceId }),
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    status: "error",
    message: "Internal server error",
    ...(traceId && { traceId }),
  });
}
