import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import { Card, CardContent } from "@/shadcn/components/card";
import { Plus, Trash2, Check, Loader2, Sparkles } from "lucide-react";
import type { Prompt } from "@/types/prompts";

const MODEL_SHORT_NAMES: Record<string, string> = {
  "amazon.nova-micro-v1:0": "Nova Micro",
  "global.anthropic.claude-haiku-4-5-20251001-v1:0": "Haiku 4.5",
  "amazon.nova-pro-v1:0": "Nova Pro",
  "us.amazon.nova-premier-v1:0": "Nova Premier",
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0": "Sonnet 4.5",
  "global.anthropic.claude-opus-4-5-20251101-v1:0": "Opus 4.5",
};

function getModelShortName(modelId: string): string {
  return MODEL_SHORT_NAMES[modelId] || modelId;
}

interface PromptListProps {
  prompts: Prompt[];
  isLoading?: boolean;
  onNewPrompt: () => void;
  onEditPrompt: (prompt: Prompt) => void;
  onSetActive: (prompt: Prompt) => void;
  onDeletePrompt: (prompt: Prompt) => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

export function PromptList({
  prompts,
  isLoading,
  onNewPrompt,
  onEditPrompt,
  onSetActive,
  onDeletePrompt,
}: PromptListProps) {
  return (
    <div className="flex flex-1 flex-col gap-3 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Prompts</span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewPrompt}
          className="gap-1"
        >
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
                className="group transition-all hover:bg-muted/50 cursor-pointer shadow-sm border-l-3 border-l-primary/60"
                onClick={() => onEditPrompt(prompt)}
              >
                <CardContent className="px-4 pt-2 pb-1.5">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-semibold text-base truncate">
                            {prompt.name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground/70 line-clamp-3">
                          {prompt.content.slice(0, 200)}
                          {prompt.content.length > 200 && "..."}
                        </span>
                      </div>
                      {prompt.status === "ACTIVE" && (
                        <Badge variant="default" className="shrink-0">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(prompt.createdAt)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-xs px-1.5 py-0"
                        >
                          {getModelShortName(prompt.model)}
                        </Badge>
                      </div>

                      <div className="flex gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        {prompt.status !== "ACTIVE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetActive(prompt);
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeletePrompt(prompt);
                            }}
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
  );
}
