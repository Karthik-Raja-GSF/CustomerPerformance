import { injectable } from 'tsyringe';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandOutput,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { config } from '@/config/index';
import { IBedrockService, BedrockResponse, StreamCallbacks } from '@/services/IBedrockService';
import { UnsupportedModelError, BedrockInvocationError } from '@/utils/errors/assistant-errors';

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
    try {
      const payload = this.buildPayload(modelId, systemPrompt, userQuestion, maxTokens);

      const command = new InvokeModelCommand({
        contentType: 'application/json',
        body: JSON.stringify(payload),
        modelId,
      });

      const response = await this.client.send(command);
      return this.parseResponse(modelId, response);
    } catch (error) {
      if (error instanceof UnsupportedModelError) {
        throw error;
      }
      throw new BedrockInvocationError(
        `Failed to invoke Bedrock model: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private buildPayload(
    modelId: string,
    system: string,
    user: string,
    maxTokens: number
  ): Record<string, unknown> {
    if (modelId.startsWith('anthropic.')) {
      return {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      };
    }
    if (modelId.startsWith('amazon.nova')) {
      return {
        system: [{ text: system }],
        messages: [
          { role: 'user', content: [{ text: user }] },
        ],
        inferenceConfig: { max_new_tokens: maxTokens },
      };
    }
    throw new UnsupportedModelError(modelId);
  }

  private parseResponse(modelId: string, response: InvokeModelCommandOutput): BedrockResponse {
    const body = JSON.parse(new TextDecoder().decode(response.body));

    let text: string;
    let usage: { inputTokens: number; outputTokens: number };

    if (modelId.startsWith('anthropic.')) {
      text = body.content[0].text;
      usage = {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      };
    } else if (modelId.startsWith('amazon.nova')) {
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
      { phrase: 'uncertain', penalty: 25 },
      { phrase: 'might be', penalty: 15 },
      { phrase: 'possibly', penalty: 10 },
      { phrase: 'i think', penalty: 5 },
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
    try {
      const payload = this.buildPayload(modelId, systemPrompt, userQuestion, maxTokens);

      const command = new InvokeModelWithResponseStreamCommand({
        contentType: 'application/json',
        body: JSON.stringify(payload),
        modelId,
      });

      const response = await this.client.send(command);

      if (!response.body) {
        throw new BedrockInvocationError('No response body from Bedrock stream');
      }

      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of response.body) {
        if (event.chunk?.bytes) {
          const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));

          // Handle Anthropic Claude models
          if (modelId.startsWith('anthropic.')) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              callbacks.onChunk(chunk.delta.text);
            } else if (chunk.type === 'message_delta' && chunk.usage) {
              outputTokens = chunk.usage.output_tokens;
            } else if (chunk.type === 'message_start' && chunk.message?.usage) {
              inputTokens = chunk.message.usage.input_tokens;
            }
          }
          // Handle Amazon Nova models
          else if (modelId.startsWith('amazon.nova')) {
            if (chunk.contentBlockDelta?.delta?.text) {
              callbacks.onChunk(chunk.contentBlockDelta.delta.text);
            } else if (chunk.metadata?.usage) {
              inputTokens = chunk.metadata.usage.inputTokens;
              outputTokens = chunk.metadata.usage.outputTokens;
            }
          }
        }
      }

      callbacks.onComplete({ inputTokens, outputTokens });
    } catch (error) {
      if (error instanceof UnsupportedModelError || error instanceof BedrockInvocationError) {
        callbacks.onError(error);
        return;
      }
      callbacks.onError(
        new BedrockInvocationError(
          `Failed to stream from Bedrock: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }
}
