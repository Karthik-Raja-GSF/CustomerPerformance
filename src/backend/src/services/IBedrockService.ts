import { ConfidenceLevel } from "@/utils/confidence-parser";

export const BEDROCK_SERVICE_TOKEN = Symbol.for("BedrockService");

export interface BedrockResponse {
  text: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  confidenceReasoning: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ConfidenceData {
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  confidenceReasoning: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (
    usage: { inputTokens: number; outputTokens: number },
    confidenceData: ConfidenceData
  ) => void;
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
