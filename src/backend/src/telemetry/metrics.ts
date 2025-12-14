/**
 * OpenTelemetry Metrics Utilities
 *
 * Provides pre-defined metric instruments for common application metrics.
 */

import {
  metrics,
  Meter,
  Counter,
  Histogram,
  UpDownCounter,
} from "@opentelemetry/api";
import { config } from "../config";

let meter: Meter | null = null;

export function getMeter(): Meter {
  if (!meter) {
    meter = metrics.getMeter(
      config.telemetry.serviceName,
      config.telemetry.serviceVersion
    );
  }
  return meter;
}

// HTTP Metrics
let httpRequestDuration: Histogram | null = null;
let httpRequestsTotal: Counter | null = null;
let httpErrorsTotal: Counter | null = null;
let activeConnections: UpDownCounter | null = null;

export function getHttpRequestDuration(): Histogram {
  if (!httpRequestDuration) {
    httpRequestDuration = getMeter().createHistogram(
      "http.server.request.duration",
      {
        description: "Duration of HTTP server requests",
        unit: "ms",
      }
    );
  }
  return httpRequestDuration;
}

export function getHttpRequestsTotal(): Counter {
  if (!httpRequestsTotal) {
    httpRequestsTotal = getMeter().createCounter("http.server.requests.total", {
      description: "Total number of HTTP server requests",
      unit: "1",
    });
  }
  return httpRequestsTotal;
}

export function getHttpErrorsTotal(): Counter {
  if (!httpErrorsTotal) {
    httpErrorsTotal = getMeter().createCounter("http.server.errors.total", {
      description: "Total number of HTTP server errors",
      unit: "1",
    });
  }
  return httpErrorsTotal;
}

export function getActiveConnections(): UpDownCounter {
  if (!activeConnections) {
    activeConnections = getMeter().createUpDownCounter(
      "http.server.active_connections",
      {
        description: "Number of active HTTP connections",
        unit: "1",
      }
    );
  }
  return activeConnections;
}

// Bedrock/LLM Metrics
let bedrockInvocations: Counter | null = null;
let bedrockLatency: Histogram | null = null;
let bedrockTokensInput: Counter | null = null;
let bedrockTokensOutput: Counter | null = null;
let bedrockErrors: Counter | null = null;

export function getBedrockInvocations(): Counter {
  if (!bedrockInvocations) {
    bedrockInvocations = getMeter().createCounter("bedrock.invocations.total", {
      description: "Total number of Bedrock model invocations",
      unit: "1",
    });
  }
  return bedrockInvocations;
}

export function getBedrockLatency(): Histogram {
  if (!bedrockLatency) {
    bedrockLatency = getMeter().createHistogram("bedrock.latency", {
      description: "Bedrock API call latency",
      unit: "ms",
    });
  }
  return bedrockLatency;
}

export function getBedrockTokensInput(): Counter {
  if (!bedrockTokensInput) {
    bedrockTokensInput = getMeter().createCounter("bedrock.tokens.input", {
      description: "Total input tokens sent to Bedrock",
      unit: "1",
    });
  }
  return bedrockTokensInput;
}

export function getBedrockTokensOutput(): Counter {
  if (!bedrockTokensOutput) {
    bedrockTokensOutput = getMeter().createCounter("bedrock.tokens.output", {
      description: "Total output tokens received from Bedrock",
      unit: "1",
    });
  }
  return bedrockTokensOutput;
}

export function getBedrockErrors(): Counter {
  if (!bedrockErrors) {
    bedrockErrors = getMeter().createCounter("bedrock.errors.total", {
      description: "Total number of Bedrock errors",
      unit: "1",
    });
  }
  return bedrockErrors;
}

// Database Metrics
let dbQueryDuration: Histogram | null = null;
let dbQueryTotal: Counter | null = null;
let dbConnectionPoolSize: UpDownCounter | null = null;

export function getDbQueryDuration(): Histogram {
  if (!dbQueryDuration) {
    dbQueryDuration = getMeter().createHistogram("db.query.duration", {
      description: "Database query execution duration",
      unit: "ms",
    });
  }
  return dbQueryDuration;
}

export function getDbQueryTotal(): Counter {
  if (!dbQueryTotal) {
    dbQueryTotal = getMeter().createCounter("db.query.total", {
      description: "Total number of database queries",
      unit: "1",
    });
  }
  return dbQueryTotal;
}

export function getDbConnectionPoolSize(): UpDownCounter {
  if (!dbConnectionPoolSize) {
    dbConnectionPoolSize = getMeter().createUpDownCounter(
      "db.connection_pool.size",
      {
        description: "Current database connection pool size",
        unit: "1",
      }
    );
  }
  return dbConnectionPoolSize;
}

// Assistant/Chat Metrics
let chatRequests: Counter | null = null;
let chatStreamEvents: Counter | null = null;
let sqlGenerationDuration: Histogram | null = null;

export function getChatRequests(): Counter {
  if (!chatRequests) {
    chatRequests = getMeter().createCounter("assistant.chat.requests.total", {
      description: "Total number of chat requests",
      unit: "1",
    });
  }
  return chatRequests;
}

export function getChatStreamEvents(): Counter {
  if (!chatStreamEvents) {
    chatStreamEvents = getMeter().createCounter(
      "assistant.chat.stream_events.total",
      {
        description: "Total number of SSE stream events sent",
        unit: "1",
      }
    );
  }
  return chatStreamEvents;
}

export function getSqlGenerationDuration(): Histogram {
  if (!sqlGenerationDuration) {
    sqlGenerationDuration = getMeter().createHistogram(
      "assistant.sql_generation.duration",
      {
        description: "Duration of SQL generation from natural language",
        unit: "ms",
      }
    );
  }
  return sqlGenerationDuration;
}
