import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/prompts";
import { sendChatMessage } from "@/apis/assistant";
import { ApiError } from "@/apis/client";

export function useTestChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(content);

      // Add AI message with metadata attached
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
        meta: {
          confidence: response.confidence,
          confidenceLevel: response.confidenceLevel,
          confidenceReasoning: response.confidenceReasoning,
          accuracy: response.accuracy,
          usage: response.usage,
          modelName: response.modelName,
          rawSql: response.rawSql,
          rawResult: response.rawResult,
          sqlStatus: response.sqlStatus,
        },
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Failed to send message";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
}
