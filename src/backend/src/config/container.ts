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
import {
  IStockIqService,
  STOCKIQ_SERVICE_TOKEN,
} from "@/services/IStockIqService";
import { StockIqService } from "@/services/implementations/StockIqService";
import {
  ISchedulerService,
  SCHEDULER_SERVICE_TOKEN,
} from "@/services/ISchedulerService";
import { SchedulerService } from "@/services/implementations/SchedulerService";
import {
  ICustomerBidService,
  CUSTOMER_BID_SERVICE_TOKEN,
} from "@/services/ICustomerBidService";
import { CustomerBidService } from "@/services/implementations/CustomerBidService";
import {
  IChatLogService,
  CHAT_LOG_SERVICE_TOKEN,
} from "@/services/IChatLogService";
import { ChatLogService } from "@/services/implementations/ChatLogService";
import {
  IBidExportService,
  BID_EXPORT_SERVICE_TOKEN,
} from "@/services/IBidExportService";
import { BidExportService } from "@/services/implementations/BidExportService";
import { IRbacService, RBAC_SERVICE_TOKEN } from "@/services/IRbacService";
import { RbacService } from "@/services/implementations/RbacService";

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

  // Register RbacService for role-based access control (singleton — config is immutable)
  container.registerSingleton<IRbacService>(RBAC_SERVICE_TOKEN, RbacService);

  // Register TokenService for JWT verification
  container.register<ITokenService>(TOKEN_SERVICE_TOKEN, {
    useClass: TokenService,
  });

  // Register PromptService for prompt management
  container.register<IPromptService>(PROMPT_SERVICE_TOKEN, {
    useClass: PromptService,
  });

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

  // Register StockIqService for StockIQ API integration
  container.register<IStockIqService>(STOCKIQ_SERVICE_TOKEN, {
    useClass: StockIqService,
  });

  // Register CustomerBidService for customer bid data retrieval
  container.register<ICustomerBidService>(CUSTOMER_BID_SERVICE_TOKEN, {
    useClass: CustomerBidService,
  });

  // Register ChatLogService for persisting AI chat history
  container.register<IChatLogService>(CHAT_LOG_SERVICE_TOKEN, {
    useClass: ChatLogService,
  });

  // Register BidExportService for export queue management
  container.register<IBidExportService>(BID_EXPORT_SERVICE_TOKEN, {
    useClass: BidExportService,
  });

  // Register SchedulerService for in-app scheduled tasks
  // Uses PostgreSQL advisory locks for distributed coordination
  // MUST be registered after StockIqService (dependency)
  container.registerSingleton<ISchedulerService>(
    SCHEDULER_SERVICE_TOKEN,
    SchedulerService
  );

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
