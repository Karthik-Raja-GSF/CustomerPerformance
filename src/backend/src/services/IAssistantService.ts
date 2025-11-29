import { ChatRequestDto, ChatResponseDto, ModelListDto } from '@/contracts/dtos/assistant.dto';

export const ASSISTANT_SERVICE_TOKEN = Symbol.for('AssistantService');

export interface IAssistantService {
  chat(request: ChatRequestDto): Promise<ChatResponseDto>;
  getAvailableModels(): ModelListDto[];
}
