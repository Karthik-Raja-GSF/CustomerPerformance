import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PromptList } from "@/components/prompt-tuning/PromptList";
import { TestChat } from "@/components/prompt-tuning/TestChat";
import { PromptModal } from "@/components/prompt-tuning/PromptModal";
import { usePromptsApi } from "@/hooks/use-prompts-api";
import { usePromptModal } from "@/hooks/use-prompt-modal";
import { useTestChat } from "@/hooks/use-test-chat";
import type { CreatePromptInput, Prompt } from "@/types/prompts";

/**
 * Extract base name and version number from a prompt name
 * e.g., "My Prompt v3" -> { baseName: "My Prompt", version: 3 }
 * e.g., "My Prompt" -> { baseName: "My Prompt", version: 1 }
 */
function parseVersionedName(name: string): {
  baseName: string;
  version: number;
} {
  const match = name.match(/^(.+?)\s*v(\d+)$/i);
  if (match && match[1] && match[2]) {
    return { baseName: match[1].trim(), version: parseInt(match[2], 10) };
  }
  return { baseName: name.trim(), version: 1 };
}

/**
 * Get the next version name for a prompt
 * Checks existing prompts to find the highest version number
 */
function getNextVersionName(currentName: string, prompts: Prompt[]): string {
  const { baseName } = parseVersionedName(currentName);

  // Find all prompts with the same base name and get their versions
  const versions = prompts
    .map((p) => parseVersionedName(p.name))
    .filter(
      (parsed) => parsed.baseName.toLowerCase() === baseName.toLowerCase()
    )
    .map((parsed) => parsed.version);

  // Get the highest version, default to 1 if none found
  const maxVersion = versions.length > 0 ? Math.max(...versions) : 1;

  return `${baseName} v${maxVersion + 1}`;
}

export default function Prompts() {
  const {
    prompts,
    activePrompt,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    activatePrompt,
  } = usePromptsApi();

  const {
    messages,
    isLoading: isChatLoading,
    sendMessage,
    clearChat,
  } = useTestChat();
  const modal = usePromptModal();

  // Fetch prompts on mount
  useEffect(() => {
    void fetchPrompts();
  }, [fetchPrompts]);

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleSave = async (input: CreatePromptInput) => {
    try {
      if (modal.mode === "edit" && modal.prompt) {
        await updatePrompt(modal.prompt.id, input);
        toast.success("Prompt updated successfully");
      } else {
        await createPrompt(input);
        toast.success("Prompt created successfully");
      }
    } catch {
      // Error is already handled in the hook
    }
  };

  const handleCreateAsNewVersion = useCallback(
    async (input: CreatePromptInput) => {
      try {
        const versionedName = getNextVersionName(input.name, prompts);
        await createPrompt({
          ...input,
          name: versionedName,
        });
        toast.success(`Created new version: ${versionedName}`);
      } catch {
        // Error is already handled in the hook
      }
    },
    [createPrompt, prompts]
  );

  const handleDelete = async (id: string) => {
    try {
      await deletePrompt(id);
      toast.success("Prompt deleted successfully");
    } catch {
      // Error is already handled in the hook
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activatePrompt(id);
      toast.success("Prompt activated successfully");
    } catch {
      // Error is already handled in the hook
    }
  };

  return (
    <div className="flex flex-1 gap-6 min-h-0">
      {/* LEFT - Prompt List (40%) */}
      <div className="flex w-[40%] flex-col gap-4 min-h-0">
        <PromptList
          prompts={prompts}
          isLoading={isLoading}
          onNewPrompt={modal.openCreate}
          onEditPrompt={modal.openEdit}
          onSetActive={(prompt) => handleActivate(prompt.id)}
          onDeletePrompt={(prompt) => handleDelete(prompt.id)}
        />
      </div>

      {/* RIGHT - Test Chat (60%) */}
      <div className="flex w-[60%] flex-col">
        <TestChat
          messages={messages}
          activePrompt={activePrompt}
          isLoading={isChatLoading}
          onSendMessage={sendMessage}
          onClearChat={clearChat}
        />
      </div>

      {/* MODAL */}
      <PromptModal
        isOpen={modal.isOpen}
        mode={modal.mode}
        prompt={modal.prompt}
        onClose={modal.close}
        onSave={handleSave}
        onCreateAsNewVersion={handleCreateAsNewVersion}
      />
    </div>
  );
}
