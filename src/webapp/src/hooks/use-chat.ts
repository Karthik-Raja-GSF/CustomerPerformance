import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { streamChatMessage, ChatStreamMetadata } from "@/apis/assistant"

const STORAGE_KEY = "starq-chat-history"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  metadata?: ChatStreamMetadata
}

interface UseChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  sendMessage: (content: string) => Promise<void>
  clearChat: () => void
  copyMessage: (messageId: string) => void
  exportChat: () => void
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function loadMessagesFromStorage(): ChatMessage[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.map((m: ChatMessage & { timestamp: string }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }))
    }
  } catch (error) {
    console.error("Failed to load chat history:", error)
  }
  return []
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessagesFromStorage)
  const [isStreaming, setIsStreaming] = useState(false)

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch (error) {
      console.error("Failed to save chat history:", error)
    }
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    // Add placeholder assistant message for streaming
    const assistantMessageId = generateId()
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setIsStreaming(true)

    try {
      await streamChatMessage(
        content,
        // onChunk - append to assistant message
        (chunk) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            )
          )
        },
        // onComplete - add metadata
        (metadata) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, metadata } : msg
            )
          )
          setIsStreaming(false)
        },
        // onError
        (error) => {
          toast.error("Failed to get response", {
            description: error.message,
          })
          // Remove empty assistant message on error
          setMessages((prev) =>
            prev.filter(
              (msg) => msg.id !== assistantMessageId || msg.content.length > 0
            )
          )
          setIsStreaming(false)
        }
      )
    } catch (error) {
      toast.error("Failed to send message")
      setIsStreaming(false)
    }
  }, [isStreaming])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const copyMessage = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId)
    if (message) {
      navigator.clipboard.writeText(message.content)
      toast.success("Copied to clipboard")
    }
  }, [messages])

  const exportChat = useCallback(() => {
    if (messages.length === 0) {
      toast.error("No messages to export")
      return
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        ...(m.metadata && { metadata: m.metadata }),
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `starq-chat-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success("Chat exported successfully")
  }, [messages])

  return {
    messages,
    isStreaming,
    sendMessage,
    clearChat,
    copyMessage,
    exportChat,
  }
}
