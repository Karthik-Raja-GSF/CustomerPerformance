/**
 * Request Telemetry Middleware
 *
 * Adds request ID to context, records request metrics, and attaches trace context to response headers.
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  getHttpRequestDuration,
  getHttpRequestsTotal,
  getHttpErrorsTotal,
  getActiveConnections,
} from "../telemetry/metrics";
import { getTraceId, getSpanId, addSpanAttributes } from "../telemetry/tracer";
import { createChildLogger } from "../telemetry/logger";

const logger = createChildLogger("http");

// Extend Express Request to include requestId
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

export function telemetryMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate or use existing request ID
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Track active connections
  const activeConnections = getActiveConnections();
  activeConnections.add(1);

  // Add request ID to response headers
  res.setHeader("x-request-id", requestId);

  // Add trace context to response headers
  const traceId = getTraceId();
  const spanId = getSpanId();
  if (traceId) {
    res.setHeader("x-trace-id", traceId);
  }
  if (spanId) {
    res.setHeader("x-span-id", spanId);
  }

  // Add attributes to the current span
  addSpanAttributes({
    "http.request_id": requestId,
    "http.route": req.path,
    "http.method": req.method,
    "http.user_agent": req.headers["user-agent"] || "unknown",
  });

  // Log incoming request
  logger.info({
    event: "request.start",
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers["user-agent"],
  });

  // Record metrics and log on response finish
  res.on("finish", () => {
    const duration = Date.now() - req.startTime;
    const statusCode = res.statusCode;
    const isError = statusCode >= 400;

    // Record request duration
    const httpRequestDuration = getHttpRequestDuration();
    httpRequestDuration.record(duration, {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: String(statusCode),
    });

    // Record request count
    const httpRequestsTotal = getHttpRequestsTotal();
    httpRequestsTotal.add(1, {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: String(statusCode),
    });

    // Record error count
    if (isError) {
      const httpErrorsTotal = getHttpErrorsTotal();
      httpErrorsTotal.add(1, {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: String(statusCode),
      });
    }

    // Decrement active connections
    activeConnections.add(-1);

    // Log response
    const logMethod = isError ? "error" : "info";
    logger[logMethod]({
      event: "request.complete",
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
    });
  });

  // Handle connection close before response
  res.on("close", () => {
    if (!res.writableEnded) {
      activeConnections.add(-1);
      logger.warn({
        event: "request.aborted",
        requestId,
        method: req.method,
        path: req.path,
        duration: Date.now() - req.startTime,
      });
    }
  });

  next();
}
