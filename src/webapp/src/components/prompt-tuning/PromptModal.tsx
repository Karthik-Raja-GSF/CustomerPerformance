import { useEffect, useState } from "react"
import MDEditor from "@uiw/react-md-editor"
import { Button } from "@/shadcn/components/button"
import { Input } from "@/shadcn/components/input"
import { Label } from "@/shadcn/components/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/components/dialog"
import { Save } from "lucide-react"
import { ModelSelector } from "./ModelSelector"
import type { CreatePromptInput } from "@/types/prompts"

interface PromptModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (input: CreatePromptInput) => void
}

export function PromptModal({
  isOpen,
  onClose,
  onSave,
}: PromptModalProps) {
  const [name, setName] = useState("")
  const [content, setContent] = useState("")
  const [model, setModel] = useState("gpt-4o")
  const [isDark, setIsDark] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("")
      setContent("")
      setModel("gpt-4o")
    }
  }, [isOpen])

  // Watch for dark mode changes
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))

    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const handleSave = () => {
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      content,
      model,
    })

    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] sm:max-w-[1400px] h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl">
            Create New Prompt
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6 flex-1 min-h-0">
          {/* Prompt Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt-name" className="text-sm font-medium">Prompt Name</Label>
            <Input
              id="prompt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter prompt name..."
              className="h-10"
            />
          </div>

          {/* LLM Model */}
          <div className="w-64">
            <ModelSelector value={model} onValueChange={setModel} />
          </div>

          {/* Prompt Content - Markdown Editor */}
          <div className="flex flex-col gap-2 flex-1 min-h-0">
            <Label className="text-sm font-medium">Prompt Content</Label>
            <div
              data-color-mode={isDark ? "dark" : "light"}
              className="flex-1 min-h-0 [&_.w-md-editor]:h-full [&_.w-md-editor]:min-h-0 [&_.w-md-editor-content]:h-[calc(100%-40px)] [&_.w-md-editor-text-input]:min-h-full [&_.w-md-editor-text]:min-h-full"
            >
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || "")}
                height="100%"
                preview="edit"
                hideToolbar={false}
                visibleDragbar={false}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t pt-4 mt-4">
          <span className="text-xs text-muted-foreground">
            {content.length} characters
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
