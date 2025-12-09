import { useState, type ComponentPropsWithoutRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { cn } from "@/shadcn/lib/utils";
import type { Components } from "react-markdown";

// Code Block with Syntax Highlighting and Copy Button
interface CodeBlockProps extends ComponentPropsWithoutRef<"code"> {
  inline?: boolean;
}

function CodeBlock({ children, className, inline, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Extract language from className (format: "language-xxx")
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const codeString = String(children).replace(/\n$/, "");

  // Detect dark mode
  const isDark = document.documentElement.classList.contains("dark");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline code (single backticks)
  if (inline || !match) {
    return (
      <code
        className={cn(
          "rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  // Code block (triple backticks)
  return (
    <div className="group relative my-4">
      {/* Language badge and copy button */}
      <div className="flex items-center justify-between rounded-t-lg bg-muted px-4 py-2 border border-b-0 border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {language || "code"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {/* Syntax highlighted code */}
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: "0.5rem",
          borderBottomRightRadius: "0.5rem",
          padding: "1rem",
          fontSize: "0.875rem",
          border: "1px solid hsl(var(--border))",
          borderTop: "none",
        }}
        showLineNumbers={codeString.split("\n").length > 3}
        wrapLines
        wrapLongLines
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

// Custom Pre wrapper (prevents double wrapping)
function Pre({ children }: ComponentPropsWithoutRef<"pre">) {
  return <>{children}</>;
}

// Table components with improved styling
function Table({ children, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="my-4 w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  );
}

function TableHead({ children, ...props }: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead className="bg-muted" {...props}>
      {children}
    </thead>
  );
}

function TableRow({ children, ...props }: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      className="border-b border-border transition-colors hover:bg-muted/50 even:bg-muted/30"
      {...props}
    >
      {children}
    </tr>
  );
}

function TableHeader({ children, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className="px-4 py-3 text-left font-semibold text-foreground"
      {...props}
    >
      {children}
    </th>
  );
}

function TableCell({ children, ...props }: ComponentPropsWithoutRef<"td">) {
  return (
    <td className="px-4 py-3 text-foreground" {...props}>
      {children}
    </td>
  );
}

// Typography components with improved spacing
function Paragraph({ children, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className="my-3 leading-relaxed" {...props}>
      {children}
    </p>
  );
}

function Heading1({ children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1 className="mt-6 mb-4 text-2xl font-bold" {...props}>
      {children}
    </h1>
  );
}

function Heading2({ children, ...props }: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2 className="mt-5 mb-3 text-xl font-semibold" {...props}>
      {children}
    </h2>
  );
}

function Heading3({ children, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3 className="mt-4 mb-2 text-lg font-semibold" {...props}>
      {children}
    </h3>
  );
}

function UnorderedList({ children, ...props }: ComponentPropsWithoutRef<"ul">) {
  return (
    <ul className="my-3 ml-6 list-disc space-y-1.5" {...props}>
      {children}
    </ul>
  );
}

function OrderedList({ children, ...props }: ComponentPropsWithoutRef<"ol">) {
  return (
    <ol className="my-3 ml-6 list-decimal space-y-1.5" {...props}>
      {children}
    </ol>
  );
}

function ListItem({ children, ...props }: ComponentPropsWithoutRef<"li">) {
  return (
    <li className="leading-relaxed" {...props}>
      {children}
    </li>
  );
}

function Blockquote({
  children,
  ...props
}: ComponentPropsWithoutRef<"blockquote">) {
  return (
    <blockquote
      className="my-4 border-l-4 border-primary/50 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  );
}

function HorizontalRule(props: ComponentPropsWithoutRef<"hr">) {
  return <hr className="my-6 border-border" {...props} />;
}

function Link({ children, href, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}

// Export all components as a single object for ReactMarkdown
export const markdownComponents: Components = {
  code: CodeBlock as Components["code"],
  pre: Pre,
  table: Table,
  thead: TableHead,
  tr: TableRow,
  th: TableHeader,
  td: TableCell,
  p: Paragraph,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  blockquote: Blockquote,
  hr: HorizontalRule,
  a: Link,
};
