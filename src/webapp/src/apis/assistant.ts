import { apiClient } from "@/apis/client"

interface ApiResponse<T> {
  status: "success" | "error"
  data: T
  message?: string
}

export interface ChatResponse {
  answer: string
  confidence: number
  usage: { inputTokens: number; outputTokens: number }
  modelId: string
  modelName: string
  promptId: string
}

export interface ModelInfo {
  id: string
  name: string
  tier: string
  description: string
}

export async function sendChatMessage(question: string): Promise<ChatResponse> {
  const response = await apiClient.post<ApiResponse<ChatResponse>>(
    "/assistant/chat",
    { question }
  )
  return response.data
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const response = await apiClient.get<ApiResponse<ModelInfo[]>>(
    "/assistant/models"
  )
  return response.data
}
