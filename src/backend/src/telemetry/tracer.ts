/**
 * OpenTelemetry Tracer Utilities
 *
 * Provides helper functions for creating custom spans and managing trace context.
 */

import {
  trace,
  Tracer,
  Span,
  SpanKind,
  SpanStatusCode,
  context,
  Context,
  SpanOptions,
  Attributes,
} from "@opentelemetry/api";
import { config } from "../config";

let tracer: Tracer | null = null;

export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(
      config.telemetry.serviceName,
      config.telemetry.serviceVersion
    );
  }
  return tracer;
}

/**
 * Get the currently active span
 */
export function getActiveSpan(): Span | undefined {
  return trace.getSpan(context.active());
}

/**
 * Get the trace ID from the current context
 */
export function getTraceId(): string | undefined {
  const span = getActiveSpan();
  return span?.spanContext().traceId;
}

/**
 * Get the span ID from the current context
 */
export function getSpanId(): string | undefined {
  const span = getActiveSpan();
  return span?.spanContext().spanId;
}

/**
 * Create a new span and execute a function within it
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const currentTracer = getTracer();
  return currentTracer.startActiveSpan(name, options || {}, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Create a new span and execute a synchronous function within it
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  options?: SpanOptions
): T {
  const currentTracer = getTracer();
  const span = currentTracer.startSpan(name, options);
  const ctx = trace.setSpan(context.active(), span);

  return context.with(ctx, () => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      if (error instanceof Error) {
        span.recordException(error);
      }
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add attributes to the current active span
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception on the current active span
 */
export function recordException(error: Error): void {
  const span = getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Create a span for Bedrock LLM invocations
 */
export async function withBedrockSpan<T>(
  modelId: string,
  operation: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(`bedrock.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      "bedrock.model": modelId,
      "bedrock.operation": operation,
      "rpc.system": "aws-api",
      "rpc.service": "bedrock-runtime",
    },
  });
}

/**
 * Create a span for database operations
 */
export async function withDbSpan<T>(
  operation: string,
  table: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpan(`db.${operation}`, fn, {
    kind: SpanKind.CLIENT,
    attributes: {
      "db.system": "postgresql",
      "db.operation": operation,
      "db.sql.table": table,
    },
  });
}

/**
 * Create a span for internal operations
 */
export async function withInternalSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  return withSpan(name, fn, {
    kind: SpanKind.INTERNAL,
    attributes,
  });
}

export type { Span, Context };
export { SpanKind, SpanStatusCode };
