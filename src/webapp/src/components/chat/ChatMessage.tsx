import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Copy, Check, Info } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { cn } from "@/shadcn/lib/utils";
import { markdownComponents } from "@/components/chat/markdown/MarkdownComponents";
import { ChatMessageFeedback } from "@/components/chat/ChatMessageFeedback";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-chat";
import type { FeedbackSentiment } from "@/apis/assistant";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onCopy: (messageId: string) => void;
  onSubmitFeedback?: (
    messageId: string,
    sentiment: FeedbackSentiment,
    reason?: string
  ) => Promise<void>;
}

export function ChatMessage({
  message,
  isStreaming,
  onCopy,
  onSubmitFeedback,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    onCopy(message.id);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

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
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <img src="/starq-q-icon.svg" alt="StarQ" className="h-5 w-5" />
        )}
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
          <div className="max-w-none text-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
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
            <span
              className="font-medium flex items-center gap-1"
              title={`SQL Generation: ${message.metadata.confidenceReasoning}\n\nNote: LLM self-assessment is generally not reliable and should not be treated as ground truth.`}
            >
              {message.metadata.confidence}% SQL confidence
              <Info className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground cursor-pointer" />
            </span>
            <span>•</span>
            <span title="SQL generation">
              SQL: {message.metadata.usage.sql.inputTokens}→
              {message.metadata.usage.sql.outputTokens}
            </span>
            <span title="Answer generation">
              Answer: {message.metadata.usage.answer.inputTokens}→
              {message.metadata.usage.answer.outputTokens}
            </span>
            <span className="font-medium" title="Total tokens">
              Total: {message.metadata.usage.total.inputTokens}→
              {message.metadata.usage.total.outputTokens}
            </span>
          </div>
        )}
      </div>

      {/* Actions: Copy + Feedback */}
      {!isUser && message.content && !isStreaming && (
        <div className="flex items-start gap-1">
          {onSubmitFeedback && message.metadata?.chatLogId && (
            <ChatMessageFeedback
              messageId={message.id}
              feedback={message.feedback}
              onSubmit={onSubmitFeedback}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
