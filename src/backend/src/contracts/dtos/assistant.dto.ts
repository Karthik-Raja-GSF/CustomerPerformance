// Request: User only sends question
export interface ChatRequestDto {
  question: string;
}

// Token usage for a single operation
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

// Detailed token usage breakdown
export interface TokenUsageBreakdown {
  sql: TokenUsage; // SQL generation step
  answer: TokenUsage; // Answer generation step
  total: TokenUsage; // Combined total
}

// SQL execution status for accuracy calculation
export type SqlStatus = "success" | "empty" | "failed" | "not_needed";

/**
 * @deprecated Use confidence (0-100 percentage) instead.
 * Kept for backward compatibility; derived from confidence percentage.
 */
export type ConfidenceLevelDto = "HIGH" | "MEDIUM" | "LOW";

// Response: Full metadata
export interface ChatResponseDto {
  answer: string;
  confidence: number; // 0-100 percentage from AI's self-assessment
  /** @deprecated Use confidence (0-100) instead. Derived from percentage. */
  confidenceLevel: ConfidenceLevelDto;
  confidenceReasoning: string; // AI's explanation for the confidence percentage
  accuracy: number; // 0-100 percentage (confidence adjusted by SQL execution status)
  usage: TokenUsageBreakdown;
  modelId: string;
  modelName: string;
  promptId: string;
}

// For GET /models endpoint
export interface ModelListDto {
  id: string;
  name: string;
  tier: string;
  description: string;
}
