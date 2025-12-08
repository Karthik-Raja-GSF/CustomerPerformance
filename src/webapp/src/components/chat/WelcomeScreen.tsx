import {
  Package,
  TrendingUp,
  Users,
  FileText,
  Search,
  BarChart3,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/shadcn/components/card";
import type { LucideIcon } from "lucide-react";

interface SuggestedPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    id: "1",
    title: "Inventory Status",
    description: "Check current stock levels",
    prompt:
      "What products do we have in stock and what are their current inventory levels?",
    icon: Package,
  },
  {
    id: "2",
    title: "Sales Analysis",
    description: "View recent sales data",
    prompt:
      "Show me the sales data for the last month. Which products sold the most?",
    icon: TrendingUp,
  },
  {
    id: "3",
    title: "Supplier Info",
    description: "Find supplier contacts",
    prompt: "List all our suppliers with their contact information",
    icon: Users,
  },
  {
    id: "4",
    title: "Forecast Overview",
    description: "View demand predictions",
    prompt: "What are the demand forecasts for the next quarter?",
    icon: BarChart3,
  },
  {
    id: "5",
    title: "Product Search",
    description: "Find specific items",
    prompt: "Help me find information about our product catalog",
    icon: Search,
  },
  {
    id: "6",
    title: "Generate Report",
    description: "Create custom reports",
    prompt: "Create a summary report of our top performing products",
    icon: FileText,
  },
];

interface WelcomeScreenProps {
  onPromptSelect: (prompt: string) => void;
}

export function WelcomeScreen({ onPromptSelect }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="max-w-2xl text-center space-y-6">
        {/* Logo and Title */}
        <div className="space-y-2">
          <div className="flex items-center justify-center">
            <h1 className="text-3xl font-bold flex items-center">
              Star
              <img
                src="/starq-q-icon.svg"
                alt="Q"
                className="h-7 w-7 ml-1"
              />
            </h1>
          </div>
          <p className="text-muted-foreground">
            Your AI-powered assistant for demand planning and procurement
          </p>
        </div>

        {/* Context Warning */}
        <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Note:</strong> Each question is processed independently. The
            AI does not see previous messages in this conversation.
          </span>
        </div>

        {/* Suggested Prompts */}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Try asking about:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_PROMPTS.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onPromptSelect(item.prompt);
                }}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
