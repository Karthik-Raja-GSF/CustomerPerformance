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

export interface ChatStreamMetadata {
  modelName: string
  promptId: string
  usage: { inputTokens: number; outputTokens: number }
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

export async function streamChatMessage(
  question: string,
  onChunk: (chunk: string) => void,
  onComplete: (metadata: ChatStreamMetadata) => void,
  onError: (error: Error) => void
): Promise<void> {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8887"
  const token = localStorage.getItem("id_token")

  try {
    const response = await fetch(`${API_BASE_URL}/assistant/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split("\n\n")

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === "chunk") {
              onChunk(data.content)
            } else if (data.type === "complete") {
              onComplete(data.metadata)
            } else if (data.type === "error") {
              onError(new Error(data.message))
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error("Unknown error"))
  }
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  const response = await apiClient.get<ApiResponse<ModelInfo[]>>(
    "/assistant/models"
  )
  return response.data
}
