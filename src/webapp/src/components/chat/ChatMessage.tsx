import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Bot, User, Copy, Check } from "lucide-react"
import { Button } from "@/shadcn/components/button"
import { cn } from "@/shadcn/lib/utils"
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat"

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
  onCopy: (messageId: string) => void
}

export function ChatMessage({ message, isStreaming, onCopy }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === "user"

  const handleCopy = () => {
    onCopy(message.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn(
        "group flex gap-4 px-4 py-6",
        isUser ? "bg-transparent" : "bg-muted/30"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-primary/10"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? "You" : "StarQ"}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-muted prose-pre:border prose-code:text-sm prose-table:border prose-table:border-border prose-th:border prose-th:border-border prose-th:px-3 prose-th:py-2 prose-th:bg-muted prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || (isStreaming ? "..." : "")}
            </ReactMarkdown>
            {isStreaming && message.content && (
              <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
            )}
          </div>
        )}

        {/* Metadata for assistant messages */}
        {!isUser && message.metadata && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{message.metadata.modelName}</span>
            <span>•</span>
            <span>
              {message.metadata.usage.inputTokens} → {message.metadata.usage.outputTokens} tokens
            </span>
          </div>
        )}
      </div>

      {/* Copy button */}
      {!isUser && message.content && !isStreaming && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  )
}
