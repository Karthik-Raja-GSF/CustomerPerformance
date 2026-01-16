import {
  ChatRequestDto,
  ChatResponseDto,
  ModelListDto,
  TokenUsageBreakdown,
  ConfidenceLevelDto,
  SqlStatus,
} from "@/contracts/dtos/assistant.dto";

export const ASSISTANT_SERVICE_TOKEN = Symbol.for("AssistantService");

export interface StreamChatMetadata {
  modelName: string;
  promptId: string;
  confidence: number;
  /** @deprecated Use confidence (0-100) instead. Derived from percentage. */
  confidenceLevel: ConfidenceLevelDto;
  confidenceReasoning: string;
  accuracy: number;
  usage: TokenUsageBreakdown;
  // Debug fields for troubleshooting
  rawSql: string | null;
  rawResult: unknown;
  sqlStatus: SqlStatus;
}

export interface StreamChatCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (metadata: StreamChatMetadata) => void;
  onError: (error: Error) => void;
}

export interface IAssistantService {
  chat(request: ChatRequestDto): Promise<ChatResponseDto>;
  chatStream(
    request: ChatRequestDto,
    callbacks: StreamChatCallbacks
  ): Promise<void>;
  getAvailableModels(): ModelListDto[];
}
