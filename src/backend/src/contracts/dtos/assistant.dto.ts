// Request: User only sends question
export interface ChatRequestDto {
  question: string;
}

// Response: Full metadata
export interface ChatResponseDto {
  answer: string;
  confidence: number; // 0-100 percentage
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  modelId: string;
  modelName: string;
  promptId: string;
}

// For GET /models endpoint
export interface ModelListDto {
  id: string;
  name: string;
  tier: string;
  description: string;
}
