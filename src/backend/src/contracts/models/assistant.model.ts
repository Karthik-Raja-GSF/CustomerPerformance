export interface ModelInfo {
  name: string;
  tier: "budget" | "economy" | "standard" | "premium" | "enterprise";
  description: string;
}

export const SUPPORTED_MODELS: Record<string, ModelInfo> = {
  "amazon.nova-micro-v1:0": {
    name: "Amazon Nova Micro",
    tier: "budget",
    description: "Fastest, lowest cost for simple tasks",
  },
  "global.anthropic.claude-haiku-4-5-20251001-v1:0": {
    name: "Claude Haiku 4.5",
    tier: "economy",
    description: "Fast and affordable for most tasks",
  },
  "amazon.nova-pro-v1:0": {
    name: "Amazon Nova Pro",
    tier: "standard",
    description: "Balanced performance and cost",
  },
  "us.amazon.nova-premier-v1:0": {
    name: "Amazon Nova Premier",
    tier: "premium",
    description: "Highest quality Amazon Nova model for complex tasks",
  },
  "global.anthropic.claude-sonnet-4-5-20250929-v1:0": {
    name: "Claude Sonnet 4.5",
    tier: "premium",
    description: "High quality for complex reasoning",
  },
  "global.anthropic.claude-opus-4-5-20251101-v1:0": {
    name: "Claude Opus 4.5",
    tier: "enterprise",
    description: "Highest quality for critical tasks",
  },
};

export type SupportedModelId = keyof typeof SUPPORTED_MODELS;
