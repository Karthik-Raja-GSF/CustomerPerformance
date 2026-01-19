/**
 * Structured Logger using OpenTelemetry Logs API
 *
 * This logger emits logs via OpenTelemetry, which are then exported via OTLP (gRPC)
 * to the Aspire Dashboard locally, or to CloudWatch in production.
 */

import {
  logs,
  SeverityNumber,
  type LogAttributes,
} from "@opentelemetry/api-logs";
import { context, trace } from "@opentelemetry/api";
import { config } from "../config";

// Pino-compatible log levels
type LogLevel = "debug" | "info" | "warn" | "error";

const severityMap: Record<LogLevel, { number: SeverityNumber; text: string }> =
  {
    debug: { number: SeverityNumber.DEBUG, text: "DEBUG" },
    info: { number: SeverityNumber.INFO, text: "INFO" },
    warn: { number: SeverityNumber.WARN, text: "WARN" },
    error: { number: SeverityNumber.ERROR, text: "ERROR" },
  };

// Get the minimum log level
const minLevel = config.nodeEnv === "development" ? "debug" : "warn";
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[minLevel];
}

/**
 * Logger interface compatible with Pino API
 */
export interface Logger {
  debug(obj: object, msg?: string): void;
  debug(msg: string): void;
  info(obj: object, msg?: string): void;
  info(msg: string): void;
  warn(obj: object, msg?: string): void;
  warn(msg: string): void;
  error(obj: object, msg?: string): void;
  error(msg: string): void;
  child(bindings: Record<string, unknown>): Logger;
}

/**
 * Creates a logger instance that exports logs via OpenTelemetry
 */
function createLoggerImpl(bindings: Record<string, unknown> = {}): Logger {
  const otelLogger = logs.getLogger(config.telemetry.serviceName);

  function emitLog(level: LogLevel, objOrMsg: object | string, msg?: string) {
    if (!shouldLog(level)) return;

    // Parse arguments (Pino-style: can be (obj, msg) or just (msg))
    let rawAttributes: Record<string, unknown>;
    let body: string;

    if (typeof objOrMsg === "string") {
      body = objOrMsg;
      rawAttributes = { ...bindings };
    } else {
      // Use msg if provided, otherwise fall back to event attribute for meaningful body
      const attrs = objOrMsg as Record<string, unknown>;
      body = msg || (typeof attrs.event === "string" ? attrs.event : "log");
      rawAttributes = { ...bindings, ...attrs };
    }

    // Get trace context
    const span = trace.getSpan(context.active());
    if (span) {
      const spanContext = span.spanContext();
      rawAttributes["traceId"] = spanContext.traceId;
      rawAttributes["spanId"] = spanContext.spanId;
    }

    // Add service metadata
    rawAttributes["service.name"] = config.telemetry.serviceName;
    rawAttributes["service.version"] = config.telemetry.serviceVersion;
    rawAttributes["deployment.environment"] = config.telemetry.environment;

    // Convert to LogAttributes (filter out non-primitive values)
    const attributes: LogAttributes = {};
    for (const [key, value] of Object.entries(rawAttributes)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === undefined
      ) {
        attributes[key] = value;
      } else if (value !== null && typeof value === "object") {
        // Serialize objects as JSON strings
        attributes[key] = JSON.stringify(value);
      }
    }

    const severity = severityMap[level];

    // Emit log via OpenTelemetry
    otelLogger.emit({
      severityNumber: severity.number,
      severityText: severity.text,
      body,
      attributes,
    });

    // Also output to console in development for immediate feedback
    if (config.nodeEnv === "development") {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] ${severity.text}`;
      const component = bindings["component"]
        ? ` [${String(bindings["component"])}]`
        : "";

      if (level === "error") {
        console.error(
          `${prefix}${component}: ${body}`,
          Object.keys(rawAttributes).length > 3 ? rawAttributes : ""
        );
      } else if (level === "warn") {
        console.warn(
          `${prefix}${component}: ${body}`,
          Object.keys(rawAttributes).length > 3 ? rawAttributes : ""
        );
      } else {
        console.log(
          `${prefix}${component}: ${body}`,
          Object.keys(rawAttributes).length > 3 ? rawAttributes : ""
        );
      }
    }
  }

  return {
    debug(objOrMsg: object | string, msg?: string) {
      emitLog("debug", objOrMsg, msg);
    },
    info(objOrMsg: object | string, msg?: string) {
      emitLog("info", objOrMsg, msg);
    },
    warn(objOrMsg: object | string, msg?: string) {
      emitLog("warn", objOrMsg, msg);
    },
    error(objOrMsg: object | string, msg?: string) {
      emitLog("error", objOrMsg, msg);
    },
    child(childBindings: Record<string, unknown>): Logger {
      return createLoggerImpl({ ...bindings, ...childBindings });
    },
  };
}

// Main logger instance
export const logger = createLoggerImpl();

// Create child loggers for different components
export function createChildLogger(component: string): Logger {
  return logger.child({ component });
}
