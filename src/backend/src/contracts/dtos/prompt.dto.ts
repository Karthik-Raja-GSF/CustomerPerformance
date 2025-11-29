/**
 * Prompt DTOs - Data Transfer Objects for API layer
 */

/**
 * Response DTO for prompt data
 *
 * All timestamps are in UTC with ISO8601 format (e.g., "2025-01-15T14:30:00.000Z")
 */
export interface PromptDto {
  id: string;
  name: string;
  content: string;
  model: string;
  status: 'ACTIVE' | 'INACTIVE';
  /** ISO8601 UTC timestamp */
  createdAt: string;
  /** ISO8601 UTC timestamp */
  updatedAt: string;
}

/**
 * Request DTO for creating a new prompt
 */
export interface CreatePromptDto {
  name: string;
  content: string;
  model: string;
}
