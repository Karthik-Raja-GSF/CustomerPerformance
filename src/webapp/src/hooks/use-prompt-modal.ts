import { useState, useCallback } from "react";
import type { Prompt } from "@/types/prompts";

interface ModalState {
  isOpen: boolean;
  mode: "create" | "edit";
  prompt: Prompt | null;
}

export function usePromptModal() {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
    mode: "create",
    prompt: null,
  });

  const openCreate = useCallback(() => {
    setState({ isOpen: true, mode: "create", prompt: null });
  }, []);

  const openEdit = useCallback((prompt: Prompt) => {
    setState({ isOpen: true, mode: "edit", prompt });
  }, []);

  const close = useCallback(() => {
    setState({ isOpen: false, mode: "create", prompt: null });
  }, []);

  return {
    isOpen: state.isOpen,
    mode: state.mode,
    prompt: state.prompt,
    openCreate,
    openEdit,
    close,
    // Keep 'open' as alias for openCreate for backward compatibility
    open: openCreate,
  };
}
