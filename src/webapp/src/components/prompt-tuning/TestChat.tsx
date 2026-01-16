import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { markdownComponents } from "@/components/chat/markdown/MarkdownComponents";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shadcn/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";
import { ScrollArea } from "@/shadcn/components/scroll-area";
import { Badge } from "@/shadcn/components/badge";
import { Send, Trash2, Bot, User, Loader2, Copy, Check } from "lucide-react";
import type {
  ChatMessage,
  Prompt,
  ChatResponseMeta,
  SqlStatus,
} from "@/types/prompts";
import { cn } from "@/shadcn/lib/utils";
import { toast } from "sonner";

interface TestChatProps {
  messages: ChatMessage[];
  activePrompt: Prompt | undefined;
  isLoading?: boolean;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
}

function getSqlStatusConfig(status: SqlStatus): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  switch (status) {
    case "success":
      return {
        label: "Success",
        variant: "default",
        className: "bg-green-600 hover:bg-green-600/80",
      };
    case "empty":
      return {
        label: "Empty Result",
        variant: "secondary",
        className: "bg-amber-500 hover:bg-amber-500/80 text-white",
      };
    case "failed":
      return {
        label: "Failed",
        variant: "destructive",
        className: "",
      };
    case "not_needed":
      return {
        label: "Not Needed",
        variant: "outline",
        className: "text-muted-foreground",
      };
    default:
      return {
        label: status,
        variant: "outline",
        className: "",
      };
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 gap-1 text-xs"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      Copy
    </Button>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ResultsTable({ data }: { data: unknown }) {
  if (!Array.isArray(data) || data.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No data</p>;
  }

  const rows = data as Record<string, unknown>[];
  const columns = Object.keys(rows[0] || {});
  const displayRows = rows.slice(0, 50);

  return (
    <div className="overflow-auto max-h-[300px] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="text-xs bg-muted/50">
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="text-xs font-mono">
                  {formatCellValue(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 50 && (
        <p className="text-xs text-muted-foreground p-2 border-t bg-muted/30">
          Showing 50 of {rows.length} rows
        </p>
      )}
    </div>
  );
}

function InlineDebugInfo({ meta }: { meta: ChatResponseMeta }) {
  const statusConfig = getSqlStatusConfig(meta.sqlStatus);
  const resultRowCount = Array.isArray(meta.rawResult)
    ? meta.rawResult.length
    : 0;

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
      {/* Status badge + SQL */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={statusConfig.variant}
          className={cn("text-xs", statusConfig.className)}
        >
          {statusConfig.label}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {meta.modelName}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {meta.confidence}% confidence
        </Badge>
        {meta.rawSql && <CopyButton text={meta.rawSql} label="SQL" />}
      </div>

      {/* Token usage */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span title="SQL generation tokens">
          SQL: {meta.usage.sql.inputTokens}→{meta.usage.sql.outputTokens}
        </span>
        <span title="Answer generation tokens">
          Answer: {meta.usage.answer.inputTokens}→
          {meta.usage.answer.outputTokens}
        </span>
        <span className="font-medium" title="Total tokens">
          Total: {meta.usage.total.inputTokens}→{meta.usage.total.outputTokens}
        </span>
      </div>

      {meta.rawSql && (
        <pre className="text-xs font-mono bg-background/50 p-2 rounded whitespace-pre-wrap break-words">
          {meta.rawSql}
        </pre>
      )}

      {/* Results table */}
      {meta.rawResult !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {resultRowCount > 0 ? `${resultRowCount} rows` : "No rows"}
            </span>
            <CopyButton
              text={JSON.stringify(meta.rawResult, null, 2)}
              label="JSON"
            />
          </div>
          <ResultsTable data={meta.rawResult} />
        </div>
      )}
    </div>
  );
}

function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

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
          "flex max-w-[98%] flex-col gap-1 rounded-lg px-4 py-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
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

        {/* Debug section for assistant messages - always visible */}
        {!isUser && message.meta && <InlineDebugInfo meta={message.meta} />}
      </div>
    </div>
  );
}

export function TestChat({
  messages,
  activePrompt,
  isLoading = false,
  onSendMessage,
  onClearChat,
}: TestChatProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              <span className="text-xs text-amber-600">
                No active prompt selected
              </span>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearChat}
            className="gap-1"
          >
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
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to test..."
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="gap-2"
          >
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
  );
}
