import { Button } from "@/shadcn/components/button"
import { Badge } from "@/shadcn/components/badge"
import { ScrollArea } from "@/shadcn/components/scroll-area"
import { Card, CardContent } from "@/shadcn/components/card"
import { Plus, Trash2, Check, Loader2 } from "lucide-react"
import type { Prompt } from "@/types/prompts"

interface PromptListProps {
  prompts: Prompt[]
  isLoading?: boolean
  onNewPrompt: () => void
  onSetActive: (prompt: Prompt) => void
  onDeletePrompt: (prompt: Prompt) => void
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else {
    return `${diffDays}d ago`
  }
}

export function PromptList({
  prompts,
  isLoading,
  onNewPrompt,
  onSetActive,
  onDeletePrompt,
}: PromptListProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Prompts</span>
        <Button variant="outline" size="sm" onClick={onNewPrompt} className="gap-1">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : prompts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No prompts yet. Create your first prompt!
            </p>
          ) : (
            prompts.map((prompt) => (
              <Card
                key={prompt.id}
                className="transition-colors hover:bg-muted/50"
              >
                <CardContent className="p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="font-medium text-sm truncate">{prompt.name}</span>
                        <span className="text-xs text-muted-foreground truncate">
                          {prompt.content.slice(0, 50)}
                          {prompt.content.length > 50 && "..."}
                        </span>
                      </div>
                      {prompt.status === "ACTIVE" && (
                        <Badge variant="default" className="shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(prompt.createdAt)}
                      </span>

                      <div className="flex gap-1">
                        {prompt.status !== "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onSetActive(prompt)}
                            title="Set as active"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {prompt.status !== "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDeletePrompt(prompt)}
                            title="Delete prompt"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
