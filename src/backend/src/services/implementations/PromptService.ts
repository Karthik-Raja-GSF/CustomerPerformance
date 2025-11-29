import { injectable, inject } from 'tsyringe';
import { PrismaClient, PromptStatus } from '@prisma/client';
import { IPromptService } from '@/services/IPromptService';
import { PromptModel } from '@/contracts/models/prompt.model';
import { PromptDto, CreatePromptDto } from '@/contracts/dtos/prompt.dto';
import {
  PromptNotFoundError,
  CannotDeleteActivePromptError,
} from '@/utils/errors/prompt-errors';

/**
 * Prompt Service Implementation
 *
 * Manages prompt CRUD operations with the constraint that
 * only one prompt can be active at a time.
 */
@injectable()
export class PromptService implements IPromptService {
  constructor(
    @inject('PrismaClient') private readonly prisma: PrismaClient
  ) {}

  /**
   * Map internal model to DTO for API response.
   * Converts Date objects to ISO8601 UTC strings.
   */
  private toDto(model: PromptModel): PromptDto {
    return {
      id: model.id,
      name: model.name,
      content: model.content,
      model: model.model,
      status: model.status,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new prompt (defaults to INACTIVE status)
   */
  async create(data: CreatePromptDto): Promise<PromptDto> {
    const prompt = await this.prisma.prompt.create({
      data: {
        name: data.name,
        content: data.content,
        model: data.model,
        status: PromptStatus.INACTIVE,
      },
    });

    return this.toDto(prompt);
  }

  /**
   * Find a prompt by its ID
   */
  async findById(id: string): Promise<PromptDto | null> {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    return prompt ? this.toDto(prompt) : null;
  }

  /**
   * Get all prompts
   */
  async findAll(): Promise<PromptDto[]> {
    const prompts = await this.prisma.prompt.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return prompts.map((prompt) => this.toDto(prompt));
  }

  /**
   * Delete a prompt by ID
   * @throws CannotDeleteActivePromptError if prompt is ACTIVE
   * @throws PromptNotFoundError if prompt doesn't exist
   */
  async delete(id: string): Promise<void> {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new PromptNotFoundError(`Prompt with id ${id} not found`);
    }

    if (prompt.status === PromptStatus.ACTIVE) {
      throw new CannotDeleteActivePromptError(
        'Cannot delete active prompt. Deactivate it first or activate another prompt.'
      );
    }

    await this.prisma.prompt.delete({
      where: { id },
    });
  }

  /**
   * Find the currently active prompt
   */
  async findActive(): Promise<PromptDto | null> {
    const prompt = await this.prisma.prompt.findFirst({
      where: { status: PromptStatus.ACTIVE },
    });

    return prompt ? this.toDto(prompt) : null;
  }

  /**
   * Set a prompt as active (deactivates all others)
   * Uses a transaction to ensure atomicity
   */
  async setActive(id: string): Promise<PromptDto> {
    const prompt = await this.prisma.prompt.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new PromptNotFoundError(`Prompt with id ${id} not found`);
    }

    // Use transaction to ensure only one prompt is active
    const [, updatedPrompt] = await this.prisma.$transaction([
      // First, deactivate all prompts
      this.prisma.prompt.updateMany({
        where: { status: PromptStatus.ACTIVE },
        data: { status: PromptStatus.INACTIVE },
      }),
      // Then, activate the target prompt
      this.prisma.prompt.update({
        where: { id },
        data: { status: PromptStatus.ACTIVE },
      }),
    ]);

    return this.toDto(updatedPrompt);
  }
}
