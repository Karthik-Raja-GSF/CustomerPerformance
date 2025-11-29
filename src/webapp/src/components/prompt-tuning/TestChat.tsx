import { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/shadcn/components/button"
import { Input } from "@/shadcn/components/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/shadcn/components/card"
import { ScrollArea } from "@/shadcn/components/scroll-area"
import { Badge } from "@/shadcn/components/badge"
import { Send, Trash2, Bot, User, Loader2 } from "lucide-react"
import type { ChatMessage, Prompt, ChatResponseMeta } from "@/types/prompts"
import { cn } from "@/shadcn/lib/utils"

interface TestChatProps {
  messages: ChatMessage[]
  activePrompt: Prompt | undefined
  isLoading?: boolean
  lastResponseMeta?: ChatResponseMeta | null
  onSendMessage: (message: string) => void
  onClearChat: () => void
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1 rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        )}
        <span
          className={cn(
            "text-xs",
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}

export function TestChat({
  messages,
  activePrompt,
  isLoading = false,
  lastResponseMeta,
  onSendMessage,
  onClearChat,
}: TestChatProps) {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim()) return
    onSendMessage(inputValue.trim())
    setInputValue("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="flex flex-1 flex-col h-full overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Test Chat</CardTitle>
          <div className="flex items-center gap-2">
            {activePrompt ? (
              <>
                <span className="text-xs text-muted-foreground">Using:</span>
                <Badge variant="outline" className="text-xs">
                  {activePrompt.name}
                </Badge>
              </>
            ) : (
              <span className="text-xs text-amber-600">No active prompt selected</span>
            )}
            {lastResponseMeta && (
              <>
                <span className="text-xs text-muted-foreground">|</span>
                <Badge variant="secondary" className="text-xs">
                  {lastResponseMeta.modelName}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {lastResponseMeta.confidence}% confident
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {lastResponseMeta.usage.inputTokens}→{lastResponseMeta.usage.outputTokens} tokens
                </span>
              </>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={onClearChat} className="gap-1">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full px-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                Send a message to test your prompt
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The active prompt will be used as the system message
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-4">
              {messages.map((message) => (
                <ChatMessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>
      </CardContent>

      <CardFooter className="border-t pt-4">
        <div className="flex w-full gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to test..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading} className="gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isLoading ? "Sending..." : "Send"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
