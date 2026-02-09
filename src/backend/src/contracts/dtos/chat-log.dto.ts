/**
 * ChatLog DTOs - API layer types for chat history
 */

/** Response DTO for a single chat log entry */
export interface ChatLogDto {
  id: string;
  userId: string;
  userEmail: string;
  question: string;
  answer: string;
  confidence: number;
  confidenceReasoning: string;
  accuracy: number;
  sqlStatus: string;
  rawSql: string | null;
  sqlInputTokens: number;
  sqlOutputTokens: number;
  answerInputTokens: number;
  answerOutputTokens: number;
  modelName: string;
  promptId: string;
  responseTimeMs: number;
  createdAt: string; // ISO8601 UTC
  feedbackSentiment: string | null;
  feedbackReason: string | null;
  feedbackAt: string | null; // ISO8601 UTC
}

/** Data required to create a new chat log entry */
export interface CreateChatLogDto {
  userId: string;
  userEmail: string;
  question: string;
  answer: string;
  confidence: number;
  confidenceReasoning: string;
  accuracy: number;
  sqlStatus: string;
  rawSql: string | null;
  rawResult: unknown;
  sqlInputTokens: number;
  sqlOutputTokens: number;
  answerInputTokens: number;
  answerOutputTokens: number;
  modelName: string;
  promptId: string;
  responseTimeMs: number;
}

/** Data required to update feedback on a chat log entry */
export interface UpdateFeedbackDto {
  feedbackSentiment: "like" | "dislike";
  feedbackReason?: string;
}
