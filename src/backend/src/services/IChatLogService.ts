import {
  ChatLogDto,
  CreateChatLogDto,
  UpdateFeedbackDto,
} from "@/contracts/dtos/chat-log.dto";

/**
 * Chat Log Service Interface
 *
 * Persists AI chat request/response pairs to the database.
 * The create method catches errors internally — DB failures must never break the chat.
 */
export const CHAT_LOG_SERVICE_TOKEN = Symbol.for("ChatLogService");

export interface IChatLogService {
  /**
   * Save a completed chat request/response to the database.
   * Returns the chatLogId on success, null on failure.
   * Catches errors internally (logs them) — never throws.
   */
  create(data: CreateChatLogDto): Promise<string | null>;

  /**
   * Update feedback (like/dislike + optional reason) on a chat log entry.
   * Throws ChatLogNotFoundError or ChatLogForbiddenError on failure.
   */
  updateFeedback(
    chatLogId: string,
    userId: string,
    data: UpdateFeedbackDto
  ): Promise<void>;

  /**
   * Retrieve chat history for a specific user, newest first.
   */
  getByUser(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<ChatLogDto[]>;
}
