/**
 * OpenTelemetry SDK Instrumentation Setup
 *
 * This file MUST be imported at the very top of the application entry point
 * before any other imports, to ensure all modules are properly instrumented.
 *
 * Local Development: Set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 (Aspire Dashboard)
 * Production (ECS): Set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 (ADOT Collector Sidecar)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

// Get OTLP endpoint from environment (defaults to local Aspire Dashboard)
const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";

// Service metadata
const serviceName = process.env.OTEL_SERVICE_NAME || "admin-panel-backend";
const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";
const environment = process.env.NODE_ENV || "development";

// Check if telemetry is enabled (can be disabled for testing)
const telemetryEnabled = process.env.OTEL_SDK_DISABLED !== "true";

// Create resource with service metadata
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: serviceName,
  [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
});

// Initialize SDK only if enabled
let sdk: NodeSDK | null = null;

if (telemetryEnabled) {
  sdk = new NodeSDK({
    resource,

    // Trace exporter - sends spans to OTLP endpoint
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),

    // Metric reader - periodically exports metrics to OTLP endpoint
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${endpoint}/v1/metrics`,
      }),
      exportIntervalMillis: 60000, // Export metrics every 60 seconds
    }),

    // Log processor - batches and exports logs to OTLP endpoint
    logRecordProcessors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${endpoint}/v1/logs`,
        })
      ),
    ],

    // Auto-instrumentation for common libraries
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
        // Configure HTTP instrumentation
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            // Ignore health check requests
            return req.url === "/health";
          },
        },
      }),
      // Prisma instrumentation for database query tracing
      new PrismaInstrumentation(),
    ],
  });

  // Start the SDK
  sdk.start();

  // Log startup info (to console since OTEL logger isn't ready yet)
  console.log(
    `[OpenTelemetry] SDK started - exporting to ${endpoint} (service: ${serviceName})`
  );
}

// Graceful shutdown handler
const shutdown = async (): Promise<void> => {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log("[OpenTelemetry] SDK shutdown complete");
    } catch (error) {
      console.error("[OpenTelemetry] SDK shutdown error:", error);
    }
  }
};

// Register shutdown handlers
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

export { sdk };
