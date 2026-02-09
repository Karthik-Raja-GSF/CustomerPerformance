import { injectable, inject } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import { IChatLogService } from "@/services/IChatLogService";
import {
  ChatLogDto,
  CreateChatLogDto,
  UpdateFeedbackDto,
} from "@/contracts/dtos/chat-log.dto";
import { ChatLogModel } from "@/contracts/models/chat-log.model";
import {
  ChatLogNotFoundError,
  ChatLogForbiddenError,
} from "@/utils/errors/chat-log-errors";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("chat-log");

@injectable()
export class ChatLogService implements IChatLogService {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  private toDto(model: ChatLogModel): ChatLogDto {
    return {
      id: model.id,
      userId: model.userId,
      userEmail: model.userEmail,
      question: model.question,
      answer: model.answer,
      confidence: model.confidence,
      confidenceReasoning: model.confidenceReasoning,
      accuracy: model.accuracy,
      sqlStatus: model.sqlStatus,
      rawSql: model.rawSql,
      sqlInputTokens: model.sqlInputTokens,
      sqlOutputTokens: model.sqlOutputTokens,
      answerInputTokens: model.answerInputTokens,
      answerOutputTokens: model.answerOutputTokens,
      modelName: model.modelName,
      promptId: model.promptId,
      responseTimeMs: model.responseTimeMs,
      createdAt: model.createdAt.toISOString(),
      feedbackSentiment: model.feedbackSentiment,
      feedbackReason: model.feedbackReason,
      feedbackAt: model.feedbackAt?.toISOString() ?? null,
    };
  }

  async create(data: CreateChatLogDto): Promise<string | null> {
    logger.info(
      {
        event: "chat-log.create",
        userId: data.userId,
        question: data.question.substring(0, 50),
      },
      "Saving chat log"
    );
    try {
      const record = await this.prisma.chatLog.create({
        data: {
          userId: data.userId,
          userEmail: data.userEmail,
          question: data.question,
          answer: data.answer,
          confidence: data.confidence,
          confidenceReasoning: data.confidenceReasoning,
          accuracy: data.accuracy,
          sqlStatus: data.sqlStatus,
          rawSql: data.rawSql,
          rawResult: data.rawResult ?? undefined,
          sqlInputTokens: data.sqlInputTokens,
          sqlOutputTokens: data.sqlOutputTokens,
          answerInputTokens: data.answerInputTokens,
          answerOutputTokens: data.answerOutputTokens,
          modelName: data.modelName,
          promptId: data.promptId,
          responseTimeMs: data.responseTimeMs,
        },
        select: { id: true },
      });
      logger.info(
        { event: "chat-log.create.success", id: record.id },
        "Chat log saved"
      );
      return record.id;
    } catch (error) {
      logger.error(
        { event: "chat-log.create.error", error },
        "Failed to save chat log"
      );
      return null;
    }
  }

  async updateFeedback(
    chatLogId: string,
    userId: string,
    data: UpdateFeedbackDto
  ): Promise<void> {
    const record = await this.prisma.chatLog.findUnique({
      where: { id: chatLogId },
      select: { userId: true },
    });

    if (!record) {
      throw new ChatLogNotFoundError(chatLogId);
    }

    if (record.userId !== userId) {
      throw new ChatLogForbiddenError();
    }

    await this.prisma.chatLog.update({
      where: { id: chatLogId },
      data: {
        feedbackSentiment: data.feedbackSentiment,
        feedbackReason: data.feedbackReason ?? null,
        feedbackAt: new Date(),
      },
    });
  }

  async getByUser(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<ChatLogDto[]> {
    const logs = await this.prisma.chatLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return logs.map((log) => this.toDto(log as ChatLogModel));
  }
}
