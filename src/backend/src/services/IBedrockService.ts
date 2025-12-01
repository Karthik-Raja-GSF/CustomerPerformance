export const BEDROCK_SERVICE_TOKEN = Symbol.for('BedrockService');

export interface BedrockResponse {
  text: string;
  confidence: number;
  usage: { inputTokens: number; outputTokens: number };
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (usage: { inputTokens: number; outputTokens: number }) => void;
  onError: (error: Error) => void;
}

export interface IBedrockService {
  invoke(
    systemPrompt: string,
    userQuestion: string,
    modelId: string,
    maxTokens?: number
  ): Promise<BedrockResponse>;

  invokeStream(
    systemPrompt: string,
    userQuestion: string,
    modelId: string,
    callbacks: StreamCallbacks,
    maxTokens?: number
  ): Promise<void>;
}
