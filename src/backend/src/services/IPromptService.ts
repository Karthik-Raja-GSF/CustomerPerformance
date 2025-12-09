import {
  PromptDto,
  CreatePromptDto,
  UpdatePromptDto,
} from "@/contracts/dtos/prompt.dto";

/**
 * Prompt Service Interface
 *
 * Defines the contract for prompt management services.
 * Returns DTOs for API consumption.
 */
export const PROMPT_SERVICE_TOKEN = Symbol.for("IPromptService");

export interface IPromptService {
  /**
   * Create a new prompt (defaults to INACTIVE status)
   * @param data - The prompt data to create
   * @returns Promise resolving to the created prompt DTO
   */
  create(data: CreatePromptDto): Promise<PromptDto>;

  /**
   * Find a prompt by its ID
   * @param id - The prompt UUID
   * @returns Promise resolving to the prompt DTO or null if not found
   */
  findById(id: string): Promise<PromptDto | null>;

  /**
   * Get all prompts
   * @returns Promise resolving to array of all prompt DTOs
   */
  findAll(): Promise<PromptDto[]>;

  /**
   * Delete a prompt by ID
   * @param id - The prompt UUID
   * @throws Error if prompt is currently ACTIVE
   */
  delete(id: string): Promise<void>;

  /**
   * Set a prompt as active (deactivates all others)
   * @param id - The prompt UUID to activate
   * @returns Promise resolving to the activated prompt DTO
   */
  setActive(id: string): Promise<PromptDto>;

  /**
   * Find the currently active prompt
   * @returns Promise resolving to the active prompt DTO or null if none active
   */
  findActive(): Promise<PromptDto | null>;

  /**
   * Update an existing prompt by ID
   * @param id - The prompt UUID
   * @param data - The fields to update
   * @returns Promise resolving to the updated prompt DTO
   * @throws PromptNotFoundError if prompt doesn't exist
   */
  update(id: string, data: UpdatePromptDto): Promise<PromptDto>;
}
