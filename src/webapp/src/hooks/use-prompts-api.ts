import { useState, useCallback } from "react";
import { apiClient, ApiError } from "@/apis/client";
import type {
  Prompt,
  CreatePromptInput,
  UpdatePromptInput,
} from "@/types/prompts";

interface ApiResponse<T> {
  status: "success" | "error";
  data: T;
  message?: string;
}

export function usePromptsApi() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePrompt = prompts.find((p) => p.status === "ACTIVE");

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ApiResponse<Prompt[]>>("/prompts");
      setPrompts(response.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to fetch prompts";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPrompt = useCallback(
    async (input: CreatePromptInput): Promise<Prompt | null> => {
      setError(null);
      try {
        const response = await apiClient.post<ApiResponse<Prompt>>(
          "/prompts",
          input
        );
        setPrompts((prev) => [response.data, ...prev]);
        return response.data;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to create prompt";
        setError(message);
        throw err;
      }
    },
    []
  );

  const deletePrompt = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await apiClient.delete(`/prompts/${id}`);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to delete prompt";
      setError(message);
      throw err;
    }
  }, []);

  const activatePrompt = useCallback(
    async (id: string): Promise<Prompt | null> => {
      setError(null);
      try {
        const response = await apiClient.patch<ApiResponse<Prompt>>(
          `/prompts/${id}/activate`
        );
        // Update local state: set all to INACTIVE, then set the target to ACTIVE
        setPrompts((prev) =>
          prev.map((p) => ({
            ...p,
            status: p.id === id ? "ACTIVE" : "INACTIVE",
          }))
        );
        return response.data;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to activate prompt";
        setError(message);
        throw err;
      }
    },
    []
  );

  const updatePrompt = useCallback(
    async (id: string, input: UpdatePromptInput): Promise<Prompt | null> => {
      setError(null);
      try {
        const response = await apiClient.put<ApiResponse<Prompt>>(
          `/prompts/${id}`,
          input
        );
        // Update the prompt in local state
        setPrompts((prev) =>
          prev.map((p) => (p.id === id ? response.data : p))
        );
        return response.data;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to update prompt";
        setError(message);
        throw err;
      }
    },
    []
  );

  return {
    prompts,
    activePrompt,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    activatePrompt,
  };
}
