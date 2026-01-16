import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage, ChatResponseMeta } from "@/types/prompts";
import { sendChatMessage } from "@/apis/assistant";
import { ApiError } from "@/apis/client";

export function useTestChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponseMeta, setLastResponseMeta] =
    useState<ChatResponseMeta | null>(null);

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

      // Add AI message
      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Store metadata for display
      setLastResponseMeta({
        confidence: response.confidence,
        confidenceLevel: response.confidenceLevel,
        confidenceReasoning: response.confidenceReasoning,
        accuracy: response.accuracy,
        usage: response.usage,
        modelName: response.modelName,
      });
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
    setLastResponseMeta(null);
  }, []);

  return {
    messages,
    isLoading,
    lastResponseMeta,
    sendMessage,
    clearChat,
  };
}
