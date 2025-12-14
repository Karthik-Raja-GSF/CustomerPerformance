import { injectable } from "tsyringe";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "@/config/index";
import {
  IBedrockService,
  BedrockResponse,
  StreamCallbacks,
} from "@/services/IBedrockService";
import {
  UnsupportedModelError,
  BedrockInvocationError,
} from "@/utils/errors/assistant-errors";
import { createChildLogger } from "@/telemetry/logger";
import {
  withBedrockSpan,
  addSpanAttributes,
  addSpanEvent,
} from "@/telemetry/tracer";
import {
  getBedrockInvocations,
  getBedrockLatency,
  getBedrockTokensInput,
  getBedrockTokensOutput,
  getBedrockErrors,
} from "@/telemetry/metrics";

const logger = createChildLogger("bedrock");

@injectable()
export class BedrockService implements IBedrockService {
  private client: BedrockRuntimeClient;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: config.bedrock.region });
  }

  async invoke(
    systemPrompt: string,
    userQuestion: string,
    modelId: string,
    maxTokens = 2000
  ): Promise<BedrockResponse> {
    const startTime = Date.now();

    return withBedrockSpan(modelId, "invoke", async () => {
      try {
        logger.info(
          { event: "bedrock.invoke.start", modelId, maxTokens },
          "Starting Bedrock invocation"
        );

        const payload = this.buildPayload(
          modelId,
          systemPrompt,
          userQuestion,
          maxTokens
        );

        const command = new InvokeModelCommand({
          contentType: "application/json",
          body: JSON.stringify(payload),
          modelId,
        });

        const response = await this.client.send(command);
        const result = this.parseResponse(modelId, response);
        const duration = Date.now() - startTime;

        // Record metrics
        getBedrockInvocations().add(1, { model: modelId, operation: "invoke" });
        getBedrockLatency().record(duration, {
          model: modelId,
          operation: "invoke",
        });
        getBedrockTokensInput().add(result.usage.inputTokens, {
          model: modelId,
        });
        getBedrockTokensOutput().add(result.usage.outputTokens, {
          model: modelId,
        });

        // Add span attributes
        addSpanAttributes({
          "bedrock.input_tokens": result.usage.inputTokens,
          "bedrock.output_tokens": result.usage.outputTokens,
          "bedrock.confidence": result.confidence,
          "bedrock.duration_ms": duration,
        });

        logger.info(
          {
            event: "bedrock.invoke.complete",
            modelId,
            duration,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            confidence: result.confidence,
          },
          "Bedrock invocation completed"
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        getBedrockErrors().add(1, { model: modelId, operation: "invoke" });
        getBedrockLatency().record(duration, {
          model: modelId,
          operation: "invoke",
          error: "true",
        });

        logger.error(
          {
            event: "bedrock.invoke.error",
            modelId,
            duration,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Bedrock invocation failed"
        );

        if (error instanceof UnsupportedModelError) {
          throw error;
        }
        throw new BedrockInvocationError(
          `Failed to invoke Bedrock model: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });
  }

  private buildPayload(
    modelId: string,
    system: string,
    user: string,
    maxTokens: number
  ): Record<string, unknown> {
    if (modelId.includes("anthropic")) {
      return {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      };
    }
    if (modelId.includes("amazon.nova")) {
      return {
        system: [{ text: system }],
        messages: [{ role: "user", content: [{ text: user }] }],
        inferenceConfig: { max_new_tokens: maxTokens },
      };
    }
    throw new UnsupportedModelError(modelId);
  }

  private parseResponse(
    modelId: string,
    response: InvokeModelCommandOutput
  ): BedrockResponse {
    const body = JSON.parse(new TextDecoder().decode(response.body));

    let text: string;
    let usage: { inputTokens: number; outputTokens: number };

    if (modelId.includes("anthropic")) {
      text = body.content[0].text;
      usage = {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      };
    } else if (modelId.includes("amazon.nova")) {
      text = body.output.message.content[0].text;
      usage = {
        inputTokens: body.usage.inputTokens,
        outputTokens: body.usage.outputTokens,
      };
    } else {
      throw new UnsupportedModelError(modelId);
    }

    return {
      text,
      confidence: this.calculateConfidence(text),
      usage,
    };
  }

  private calculateConfidence(text: string): number {
    let confidence = 85;
    const textLower = text.toLowerCase();

    const penalties = [
      { phrase: "i'm not sure", penalty: 30 },
      { phrase: "i don't know", penalty: 40 },
      { phrase: "uncertain", penalty: 25 },
      { phrase: "might be", penalty: 15 },
      { phrase: "possibly", penalty: 10 },
      { phrase: "i think", penalty: 5 },
    ];

    for (const { phrase, penalty } of penalties) {
      if (textLower.includes(phrase)) confidence -= penalty;
    }

    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount > 2) confidence -= 15;

    return Math.max(0, Math.min(100, confidence));
  }

  async invokeStream(
    systemPrompt: string,
    userQuestion: string,
    modelId: string,
    callbacks: StreamCallbacks,
    maxTokens = 2000
  ): Promise<void> {
    const startTime = Date.now();

    return withBedrockSpan(modelId, "invokeStream", async () => {
      try {
        logger.info(
          { event: "bedrock.stream.start", modelId, maxTokens },
          "Starting Bedrock stream"
        );

        const payload = this.buildPayload(
          modelId,
          systemPrompt,
          userQuestion,
          maxTokens
        );

        const command = new InvokeModelWithResponseStreamCommand({
          contentType: "application/json",
          body: JSON.stringify(payload),
          modelId,
        });

        const response = await this.client.send(command);

        if (!response.body) {
          throw new BedrockInvocationError(
            "No response body from Bedrock stream"
          );
        }

        let inputTokens = 0;
        let outputTokens = 0;
        let chunkCount = 0;

        addSpanEvent("stream.started");

        for await (const event of response.body) {
          if (event.chunk?.bytes) {
            const chunk = JSON.parse(
              new TextDecoder().decode(event.chunk.bytes)
            );

            // Handle Anthropic Claude models
            if (modelId.includes("anthropic")) {
              if (chunk.type === "content_block_delta" && chunk.delta?.text) {
                callbacks.onChunk(chunk.delta.text);
                chunkCount++;
              } else if (chunk.type === "message_delta" && chunk.usage) {
                outputTokens = chunk.usage.output_tokens;
              } else if (
                chunk.type === "message_start" &&
                chunk.message?.usage
              ) {
                inputTokens = chunk.message.usage.input_tokens;
              }
            }
            // Handle Amazon Nova models
            else if (modelId.includes("amazon.nova")) {
              if (chunk.contentBlockDelta?.delta?.text) {
                callbacks.onChunk(chunk.contentBlockDelta.delta.text);
                chunkCount++;
              } else if (chunk.metadata?.usage) {
                inputTokens = chunk.metadata.usage.inputTokens;
                outputTokens = chunk.metadata.usage.outputTokens;
              }
            }
          }
        }

        const duration = Date.now() - startTime;

        // Record metrics
        getBedrockInvocations().add(1, { model: modelId, operation: "stream" });
        getBedrockLatency().record(duration, {
          model: modelId,
          operation: "stream",
        });
        getBedrockTokensInput().add(inputTokens, { model: modelId });
        getBedrockTokensOutput().add(outputTokens, { model: modelId });

        // Add span attributes
        addSpanAttributes({
          "bedrock.input_tokens": inputTokens,
          "bedrock.output_tokens": outputTokens,
          "bedrock.chunk_count": chunkCount,
          "bedrock.duration_ms": duration,
        });

        addSpanEvent("stream.completed", { chunkCount });

        logger.info(
          {
            event: "bedrock.stream.complete",
            modelId,
            duration,
            inputTokens,
            outputTokens,
            chunkCount,
          },
          "Bedrock stream completed"
        );

        callbacks.onComplete({ inputTokens, outputTokens });
      } catch (error) {
        const duration = Date.now() - startTime;
        getBedrockErrors().add(1, { model: modelId, operation: "stream" });
        getBedrockLatency().record(duration, {
          model: modelId,
          operation: "stream",
          error: "true",
        });

        logger.error(
          {
            event: "bedrock.stream.error",
            modelId,
            duration,
            error: error instanceof Error ? error.message : "Unknown error",
          },
          "Bedrock stream failed"
        );

        if (
          error instanceof UnsupportedModelError ||
          error instanceof BedrockInvocationError
        ) {
          callbacks.onError(error);
          return;
        }
        callbacks.onError(
          new BedrockInvocationError(
            `Failed to stream from Bedrock: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        );
      }
    });
  }
}
