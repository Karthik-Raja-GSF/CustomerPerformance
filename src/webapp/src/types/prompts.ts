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

export interface ChatResponseMeta {
  confidence: number;
  usage: { inputTokens: number; outputTokens: number };
  modelName: string;
}
