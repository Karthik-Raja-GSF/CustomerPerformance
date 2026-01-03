/**
 * OpenTelemetry SDK Instrumentation Setup
 *
 * This file MUST be imported at the very top of the application entry point
 * before any other imports, to ensure all modules are properly instrumented.
 *
 * Configuration via environment variables (exporters read these automatically):
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Base URL (default: http://localhost:4317)
 * - OTEL_EXPORTER_OTLP_PROTOCOL: Protocol (default: grpc)
 * - OTEL_SERVICE_NAME: Service name
 * - OTEL_SERVICE_VERSION: Service version
 * - OTEL_SDK_DISABLED: Set to "true" to disable telemetry
 *
 * Local Development: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 (Aspire Dashboard)
 * Production (ECS): OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 (ADOT Collector Sidecar)
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

// Read from environment (for logging and resource - exporters read OTEL_EXPORTER_OTLP_ENDPOINT directly)
const serviceName = process.env.OTEL_SERVICE_NAME || "ait-backend";
const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";
const telemetryEnabled = process.env.OTEL_SDK_DISABLED !== "true";

// Create resource with service metadata
const resource = new Resource({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
});

// Initialize SDK only if enabled
let sdk: NodeSDK | null = null;

if (telemetryEnabled) {
  sdk = new NodeSDK({
    resource,

    // gRPC exporters read OTEL_EXPORTER_OTLP_ENDPOINT automatically
    // DO NOT pass url - let the SDK handle it from environment variables
    traceExporter: new OTLPTraceExporter(),

    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: 5000, // 5 seconds - matches official Aspire example
    }),

    logRecordProcessors: [new BatchLogRecordProcessor(new OTLPLogExporter())],

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

  // Log startup info
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317";
  console.log(
    `[OpenTelemetry] SDK started - endpoint: ${endpoint}, service: ${serviceName}`
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
