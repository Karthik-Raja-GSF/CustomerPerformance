import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import { ITokenService, TOKEN_SERVICE_TOKEN } from "@/services/ITokenService";
import { TokenService } from "@/services/implementations/TokenService";
import {
  IPromptService,
  PROMPT_SERVICE_TOKEN,
} from "@/services/IPromptService";
import { PromptService } from "@/services/implementations/PromptService";
// TODO: SIQ Import temporarily disabled - will be reformed with new architecture
// import { ISiqImportService, SIQ_IMPORT_SERVICE_TOKEN } from '@/services/ISiqImportService';
// import { SiqImportService } from '@/services/implementations/SiqImportService';
import {
  IBedrockService,
  BEDROCK_SERVICE_TOKEN,
} from "@/services/IBedrockService";
import { BedrockService } from "@/services/implementations/BedrockService";
import {
  IMcpClientService,
  MCP_CLIENT_SERVICE_TOKEN,
} from "@/services/IMcpClientService";
import { McpClientService } from "@/services/implementations/McpClientService";
import {
  IAssistantService,
  ASSISTANT_SERVICE_TOKEN,
} from "@/services/IAssistantService";
import { AssistantService } from "@/services/implementations/AssistantService";

/**
 * DI Container Configuration
 *
 * This file sets up the TSyringe dependency injection container
 * for the application. It registers application-wide dependencies
 * and interface-to-implementation mappings.
 */

/**
 * Initialize and configure the DI container with application dependencies
 *
 * @param prisma - PrismaClient instance to register as a singleton
 */
export function setupContainer(prisma: PrismaClient): void {
  // Register PrismaClient as a singleton
  // All repositories will receive the same Prisma instance
  container.register<PrismaClient>("PrismaClient", {
    useValue: prisma,
  });

  // Register TokenService for JWT verification
  container.register<ITokenService>(TOKEN_SERVICE_TOKEN, {
    useClass: TokenService,
  });

  // Register PromptService for prompt management
  container.register<IPromptService>(PROMPT_SERVICE_TOKEN, {
    useClass: PromptService,
  });

  // TODO: SIQ Import temporarily disabled - will be reformed with new architecture
  // container.register<ISiqImportService>(SIQ_IMPORT_SERVICE_TOKEN, {
  //   useClass: SiqImportService,
  // });

  // Register BedrockService for AWS Bedrock LLM invocation
  container.register<IBedrockService>(BEDROCK_SERVICE_TOKEN, {
    useClass: BedrockService,
  });

  // Register McpClientService as singleton for PostgreSQL MCP access
  container.registerSingleton<IMcpClientService>(
    MCP_CLIENT_SERVICE_TOKEN,
    McpClientService
  );

  // Register AssistantService for AI assistant functionality
  container.register<IAssistantService>(ASSISTANT_SERVICE_TOKEN, {
    useClass: AssistantService,
  });

  // Register Repository implementations
  // Example:
  // container.register<IUserRepository>(USER_REPOSITORY_TOKEN, {
  //   useClass: UserRepository,
  // });

  // Register Service implementations
  // Example:
  // container.register<IUserService>(USER_SERVICE_TOKEN, {
  //   useClass: UserService,
  // });
}

/**
 * Reset the container (useful for testing)
 */
export function resetContainer(): void {
  container.clearInstances();
}

/**
 * Export the container for direct access when needed
 */
export { container };
