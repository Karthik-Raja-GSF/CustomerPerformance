import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface DashboardConstructProps {
  naming: NamingConfig;
}

/**
 * CloudWatch Dashboard for AIT Backend Metrics
 *
 * Displays OpenTelemetry metrics exported via ADOT Collector to CloudWatch EMF.
 * Organized into 4 sections: HTTP, Bedrock/LLM, Database, and Assistant.
 */
export class DashboardConstruct extends Construct {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: DashboardConstructProps) {
    super(scope, id);

    const { naming } = props;
    const n = createNamingHelper(naming);

    // Constants from otel-collector-config.yaml
    const NAMESPACE = "AIT/Backend";
    const SERVICE_NAME = `ait-${naming.env}-backend`;

    const dashboardName = n.name(ResourceTypes.CLOUDWATCH, "dashboard", "01");

    // Helper to create metrics with common dimensions
    const createMetric = (
      metricName: string,
      options: {
        statistic?: string;
        period?: cdk.Duration;
        dimensions?: Record<string, string>;
        label?: string;
      } = {}
    ): cloudwatch.Metric => {
      return new cloudwatch.Metric({
        namespace: NAMESPACE,
        metricName,
        dimensionsMap: {
          "service.name": SERVICE_NAME,
          ...options.dimensions,
        },
        statistic: options.statistic ?? "Sum",
        period: options.period ?? cdk.Duration.minutes(1),
        label: options.label,
      });
    };

    // Create the dashboard
    this.dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName,
      defaultInterval: cdk.Duration.hours(3),
    });

    // ===================
    // HTTP Metrics Section
    // ===================
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# HTTP Metrics",
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      // HTTP Request Rate
      new cloudwatch.GraphWidget({
        title: "Request Rate",
        width: 12,
        height: 6,
        left: [
          createMetric("http.server.requests.total", {
            statistic: "Sum",
            label: "Requests/min",
          }),
        ],
        leftYAxis: { label: "Requests", showUnits: false },
      }),

      // HTTP Request Duration (percentiles)
      new cloudwatch.GraphWidget({
        title: "Request Duration",
        width: 12,
        height: 6,
        left: [
          createMetric("http.server.request.duration", {
            statistic: "p50",
            label: "p50",
          }),
          createMetric("http.server.request.duration", {
            statistic: "p90",
            label: "p90",
          }),
          createMetric("http.server.request.duration", {
            statistic: "p99",
            label: "p99",
          }),
        ],
        leftYAxis: { label: "Duration (ms)", showUnits: false },
      })
    );

    this.dashboard.addWidgets(
      // HTTP Error Rate
      new cloudwatch.GraphWidget({
        title: "Error Rate",
        width: 12,
        height: 6,
        left: [
          createMetric("http.server.errors.total", {
            statistic: "Sum",
            label: "Errors/min",
          }),
        ],
        leftYAxis: { label: "Errors", showUnits: false },
      }),

      // Active Connections
      new cloudwatch.SingleValueWidget({
        title: "Active Connections",
        width: 12,
        height: 6,
        metrics: [
          createMetric("http.server.active_connections", {
            statistic: "Average",
            label: "Connections",
          }),
        ],
      })
    );

    // ===================
    // Bedrock/LLM Metrics Section
    // ===================
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Bedrock / LLM Metrics",
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      // Bedrock Invocations
      new cloudwatch.GraphWidget({
        title: "Model Invocations",
        width: 12,
        height: 6,
        left: [
          createMetric("bedrock.invocations.total", {
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Invocations",
          }),
        ],
        leftYAxis: { label: "Invocations", showUnits: false },
      }),

      // Bedrock Latency
      new cloudwatch.GraphWidget({
        title: "Model Latency",
        width: 12,
        height: 6,
        left: [
          createMetric("bedrock.latency", {
            statistic: "p50",
            label: "p50",
          }),
          createMetric("bedrock.latency", {
            statistic: "p90",
            label: "p90",
          }),
          createMetric("bedrock.latency", {
            statistic: "p99",
            label: "p99",
          }),
        ],
        leftYAxis: { label: "Latency (ms)", showUnits: false },
      })
    );

    this.dashboard.addWidgets(
      // Token Usage (stacked)
      new cloudwatch.GraphWidget({
        title: "Token Usage",
        width: 12,
        height: 6,
        stacked: true,
        left: [
          createMetric("bedrock.tokens.input", {
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Input Tokens",
          }),
          createMetric("bedrock.tokens.output", {
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Output Tokens",
          }),
        ],
        leftYAxis: { label: "Tokens", showUnits: false },
      }),

      // Bedrock Errors
      new cloudwatch.GraphWidget({
        title: "Model Errors",
        width: 12,
        height: 6,
        left: [
          createMetric("bedrock.errors.total", {
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Errors",
          }),
        ],
        leftYAxis: { label: "Errors", showUnits: false },
      })
    );

    // ===================
    // Database Metrics Section
    // ===================
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Database Metrics",
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      // DB Query Rate
      new cloudwatch.GraphWidget({
        title: "Query Rate",
        width: 12,
        height: 6,
        left: [
          createMetric("db.query.total", {
            statistic: "Sum",
            label: "Queries/min",
          }),
        ],
        leftYAxis: { label: "Queries", showUnits: false },
      }),

      // DB Query Duration
      new cloudwatch.GraphWidget({
        title: "Query Duration",
        width: 12,
        height: 6,
        left: [
          createMetric("db.query.duration", {
            statistic: "p50",
            label: "p50",
          }),
          createMetric("db.query.duration", {
            statistic: "p90",
            label: "p90",
          }),
          createMetric("db.query.duration", {
            statistic: "p99",
            label: "p99",
          }),
        ],
        leftYAxis: { label: "Duration (ms)", showUnits: false },
      })
    );

    this.dashboard.addWidgets(
      // Connection Pool Size
      new cloudwatch.SingleValueWidget({
        title: "Connection Pool Size",
        width: 12,
        height: 6,
        metrics: [
          createMetric("db.connection_pool.size", {
            statistic: "Average",
            label: "Pool Size",
          }),
        ],
      }),

      // Empty placeholder for alignment
      new cloudwatch.TextWidget({
        markdown: "",
        width: 12,
        height: 6,
      })
    );

    // ===================
    // Assistant Metrics Section
    // ===================
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: "# Assistant Metrics",
        width: 24,
        height: 1,
      })
    );

    this.dashboard.addWidgets(
      // Chat Requests
      new cloudwatch.GraphWidget({
        title: "Chat Requests",
        width: 12,
        height: 6,
        left: [
          createMetric("assistant.chat.requests.total", {
            statistic: "Sum",
            period: cdk.Duration.minutes(5),
            label: "Requests",
          }),
        ],
        leftYAxis: { label: "Requests", showUnits: false },
      }),

      // SQL Generation Duration
      new cloudwatch.GraphWidget({
        title: "SQL Generation Duration",
        width: 12,
        height: 6,
        left: [
          createMetric("assistant.sql_generation.duration", {
            statistic: "p50",
            label: "p50",
          }),
          createMetric("assistant.sql_generation.duration", {
            statistic: "p90",
            label: "p90",
          }),
          createMetric("assistant.sql_generation.duration", {
            statistic: "p99",
            label: "p99",
          }),
        ],
        leftYAxis: { label: "Duration (ms)", showUnits: false },
      })
    );

    this.dashboard.addWidgets(
      // Stream Events
      new cloudwatch.GraphWidget({
        title: "Stream Events",
        width: 12,
        height: 6,
        left: [
          createMetric("assistant.chat.stream_events.total", {
            statistic: "Sum",
            label: "Events/min",
          }),
        ],
        leftYAxis: { label: "Events", showUnits: false },
      }),

      // Empty placeholder for alignment
      new cloudwatch.TextWidget({
        markdown: "",
        width: 12,
        height: 6,
      })
    );

    // Apply standard tags
    addStandardTags(this.dashboard, naming.env, dashboardName);
  }
}
