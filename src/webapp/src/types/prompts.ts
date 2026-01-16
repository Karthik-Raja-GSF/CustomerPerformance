export interface Prompt {
  id: string;
  name: string;
  content: string;
  model: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  meta?: ChatResponseMeta; // Debug metadata for assistant messages
}

export interface CreatePromptInput {
  name: string;
  content: string;
  model: string;
}

export interface UpdatePromptInput {
  name?: string;
  content?: string;
  model?: string;
}

export const LLM_MODELS = [
  { value: "amazon.nova-micro-v1:0", label: "Amazon Nova Micro (Budget)" },
  {
    value: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5 (Economy)",
  },
  { value: "amazon.nova-pro-v1:0", label: "Amazon Nova Pro (Standard)" },
  {
    value: "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    label: "Claude Sonnet 4.5 (Premium)",
  },
  {
    value: "global.anthropic.claude-opus-4-5-20251101-v1:0",
    label: "Claude Opus 4.5 (Enterprise)",
  },
] as const;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface TokenUsageBreakdown {
  sql: TokenUsage;
  answer: TokenUsage;
  total: TokenUsage;
}

/** @deprecated Use confidence (0-100) instead. Kept for backward compatibility. */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type SqlStatus = "success" | "empty" | "failed" | "not_needed";

export interface ChatResponseMeta {
  confidence: number; // 0-100 percentage from AI's self-assessment
  /** @deprecated Use confidence instead. Derived from percentage. */
  confidenceLevel: ConfidenceLevel;
  confidenceReasoning: string; // AI's explanation for the confidence percentage
  accuracy: number;
  usage: TokenUsageBreakdown;
  modelName: string;
  // Debug fields for troubleshooting
  rawSql: string | null;
  rawResult: unknown;
  sqlStatus: SqlStatus;
}
