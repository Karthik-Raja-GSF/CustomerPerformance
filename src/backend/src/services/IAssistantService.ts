import { ChatRequestDto, ChatResponseDto, ModelListDto } from '@/contracts/dtos/assistant.dto';

export const ASSISTANT_SERVICE_TOKEN = Symbol.for('AssistantService');

export interface StreamChatCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (metadata: { modelName: string; promptId: string; usage: { inputTokens: number; outputTokens: number } }) => void;
  onError: (error: Error) => void;
}

export interface IAssistantService {
  chat(request: ChatRequestDto): Promise<ChatResponseDto>;
  chatStream(request: ChatRequestDto, callbacks: StreamChatCallbacks): Promise<void>;
  getAvailableModels(): ModelListDto[];
}
