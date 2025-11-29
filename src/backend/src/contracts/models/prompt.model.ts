import { PromptStatus } from '@prisma/client';

/**
 * Prompt Model - Internal model matching Prisma schema
 */
export interface PromptModel {
  id: string;
  name: string;
  content: string;
  model: string;
  status: PromptStatus;
  createdAt: Date;
  updatedAt: Date;
}
