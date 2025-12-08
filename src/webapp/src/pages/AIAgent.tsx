import { useRef, useEffect } from "react"
import { Trash2, Download } from "lucide-react"
import { Button } from "@/shadcn/components/button"
import { ScrollArea } from "@/shadcn/components/scroll-area"
import { Separator } from "@/shadcn/components/separator"
import { ChatMessage, ChatInput, WelcomeScreen } from "@/components/chat"
import { useChat } from "@/hooks/use-chat"

export default function AIAgent() {
  const { messages, isStreaming, sendMessage, clearChat, copyMessage, exportChat } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden relative">
      {/* Background watermark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/starq-q-icon.svg')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center center",
          backgroundSize: "70%",
          opacity: 0.05,
          zIndex: 0,
        }}
      />

      {/* Header with actions */}
      {hasMessages && (
        <>
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-b">
            <Button
              variant="ghost"
              size="sm"
              onClick={exportChat}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
          <Separator />
        </>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        {hasMessages ? (
          <ScrollArea className="h-full" ref={scrollRef}>
            <div className="max-w-3xl mx-auto">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={isStreaming && index === messages.length - 1 && message.role === "assistant"}
                  onCopy={copyMessage}
                />
              ))}
            </div>
          </ScrollArea>
        ) : (
          <WelcomeScreen onPromptSelect={sendMessage} />
        )}
      </div>

      {/* Input area */}
      <ChatInput onSend={sendMessage} isStreaming={isStreaming} />
    </div>
  )
}
