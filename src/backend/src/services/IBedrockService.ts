export const BEDROCK_SERVICE_TOKEN = Symbol.for('BedrockService');

export interface BedrockResponse {
  text: string;
  confidence: number;
  usage: { inputTokens: number; outputTokens: number };
}

export interface IBedrockService {
  invoke(
    systemPrompt: string,
    userQuestion: string,
    modelId: string,
    maxTokens?: number
  ): Promise<BedrockResponse>;
}
