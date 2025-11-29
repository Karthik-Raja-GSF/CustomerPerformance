import { useEffect } from "react"
import { toast } from "sonner"
import { PromptList } from "@/components/prompt-tuning/PromptList"
import { TestChat } from "@/components/prompt-tuning/TestChat"
import { PromptModal } from "@/components/prompt-tuning/PromptModal"
import { usePromptsApi } from "@/hooks/use-prompts-api"
import { usePromptModal } from "@/hooks/use-prompt-modal"
import { useTestChat } from "@/hooks/use-test-chat"
import type { CreatePromptInput } from "@/types/prompts"

export default function Prompts() {
  const {
    prompts,
    activePrompt,
    isLoading,
    error,
    fetchPrompts,
    createPrompt,
    deletePrompt,
    activatePrompt,
  } = usePromptsApi()

  const { messages, isLoading: isChatLoading, lastResponseMeta, sendMessage, clearChat } = useTestChat()
  const modal = usePromptModal()

  // Fetch prompts on mount
  useEffect(() => {
    fetchPrompts()
  }, [fetchPrompts])

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const handleCreate = async (input: CreatePromptInput) => {
    try {
      await createPrompt(input)
      toast.success("Prompt created successfully")
    } catch {
      // Error is already handled in the hook
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePrompt(id)
      toast.success("Prompt deleted successfully")
    } catch {
      // Error is already handled in the hook
    }
  }

  const handleActivate = async (id: string) => {
    try {
      await activatePrompt(id)
      toast.success("Prompt activated successfully")
    } catch {
      // Error is already handled in the hook
    }
  }

  return (
    <div className="flex flex-1 gap-6 min-h-0">
      {/* LEFT - Prompt List (40%) */}
      <div className="flex w-[40%] flex-col gap-4 min-h-0">
        <PromptList
          prompts={prompts}
          isLoading={isLoading}
          onNewPrompt={modal.open}
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
          lastResponseMeta={lastResponseMeta}
          onSendMessage={sendMessage}
          onClearChat={clearChat}
        />
      </div>

      {/* MODAL */}
      <PromptModal
        isOpen={modal.isOpen}
        onClose={modal.close}
        onSave={handleCreate}
      />
    </div>
  )
}
