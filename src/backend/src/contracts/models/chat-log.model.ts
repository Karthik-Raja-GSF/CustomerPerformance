/**
 * ChatLog Model - Matches Prisma ChatLog schema
 */
export interface ChatLogModel {
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
  rawResult: unknown;
  sqlInputTokens: number;
  sqlOutputTokens: number;
  answerInputTokens: number;
  answerOutputTokens: number;
  modelName: string;
  promptId: string;
  responseTimeMs: number;
  createdAt: Date;
  feedbackSentiment: string | null;
  feedbackReason: string | null;
  feedbackAt: Date | null;
}
