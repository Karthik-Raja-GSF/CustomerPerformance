import { injectable, inject } from "tsyringe";
import { readFileSync } from "fs";
import { join } from "path";
import {
  IAssistantService,
  StreamChatCallbacks,
} from "@/services/IAssistantService";
import {
  IBedrockService,
  BEDROCK_SERVICE_TOKEN,
} from "@/services/IBedrockService";
import {
  IPromptService,
  PROMPT_SERVICE_TOKEN,
} from "@/services/IPromptService";
import {
  IMcpClientService,
  MCP_CLIENT_SERVICE_TOKEN,
} from "@/services/IMcpClientService";
import {
  ChatRequestDto,
  ChatResponseDto,
  ModelListDto,
  TokenUsage,
  SqlStatus,
} from "@/contracts/dtos/assistant.dto";
import { SUPPORTED_MODELS } from "@/contracts/models/assistant.model";
import {
  NoActivePromptError,
  UnsupportedModelError,
} from "@/utils/errors/assistant-errors";
import { getSqlGenerationDuration } from "@/telemetry/metrics";
import { createChildLogger } from "@/telemetry/logger";

const logger = createChildLogger("assistant-service");

@injectable()
export class AssistantService implements IAssistantService {
  private baseSystemPrompt: string;
  private sqlGenerationPromptTemplate: string;
  private mcpInitialized = false;

  private bedrockService: IBedrockService;
  private promptService: IPromptService;
  private mcpClient: IMcpClientService;

  constructor(
    @inject(BEDROCK_SERVICE_TOKEN) bedrockService: IBedrockService,
    @inject(PROMPT_SERVICE_TOKEN) promptService: IPromptService,
    @inject(MCP_CLIENT_SERVICE_TOKEN) mcpClient: IMcpClientService
  ) {
    this.bedrockService = bedrockService;
    this.promptService = promptService;
    this.mcpClient = mcpClient;
    this.baseSystemPrompt = this.loadBaseSystemPrompt();
    this.sqlGenerationPromptTemplate = this.loadSqlGenerationPrompt();
  }

  private async ensureMcpInitialized(): Promise<void> {
    if (!this.mcpInitialized) {
      await this.mcpClient.initialize();
      this.mcpInitialized = true;
    }
  }

  private buildSqlGenerationPrompt(question: string): string {
    return this.sqlGenerationPromptTemplate.replace("{{question}}", question);
  }

  private extractSqlFromResponse(response: string): string | null {
    const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
    if (sqlMatch && sqlMatch[1]) {
      return sqlMatch[1].trim();
    }

    if (response.includes("NO_QUERY_NEEDED")) {
      return null;
    }

    return null;
  }

  private isSelectQuery(sql: string): boolean {
    const normalized = sql.trim().toUpperCase();
    return (
      normalized.startsWith("SELECT") &&
      !normalized.includes("INSERT") &&
      !normalized.includes("UPDATE") &&
      !normalized.includes("DELETE") &&
      !normalized.includes("DROP") &&
      !normalized.includes("ALTER") &&
      !normalized.includes("TRUNCATE")
    );
  }

  private truncateResults(results: unknown): string {
    const MAX_ROWS = 50;
    const MAX_CHARS = 10000;

    let truncatedResults = results;
    let totalRows = 0;
    let wasTruncated = false;

    if (Array.isArray(results)) {
      totalRows = results.length;
      if (results.length > MAX_ROWS) {
        truncatedResults = results.slice(0, MAX_ROWS);
        wasTruncated = true;
      }
    }

    let jsonString = JSON.stringify(truncatedResults, null, 2);

    if (jsonString.length > MAX_CHARS) {
      jsonString =
        jsonString.slice(0, MAX_CHARS) + "\n... (truncated due to size)";
      wasTruncated = true;
    }

    if (wasTruncated && totalRows > MAX_ROWS) {
      jsonString += `\n\n[Note: Showing ${MAX_ROWS} of ${totalRows} total records]`;
    }

    return jsonString;
  }

  private buildAnswerPrompt(
    base: string,
    dbPrompt: string,
    queryResults: string
  ): string {
    let prompt = `${base}\n\n## Additional Context\n\n${dbPrompt}`;

    if (queryResults) {
      prompt += `\n\n## Database Query Results

**IMPORTANT: The SQL query has already been executed automatically. DO NOT show SQL code to the user.**

Here is the data retrieved from the database:
\`\`\`json
${queryResults}
\`\`\`

**Instructions for your response:**
1. NEVER show SQL queries or code blocks with SQL
2. Use the data above to answer the user's question directly
3. Format the response as clean, readable text with tables if appropriate
4. Focus on insights and actionable information`;
    } else {
      prompt += `\n\nNo database query was needed for this question. Answer directly without mentioning SQL or databases.`;
    }

    return prompt;
  }

  private loadBaseSystemPrompt(): string {
    const promptPath = join(__dirname, "../../config/system_prompt.md");
    return readFileSync(promptPath, "utf-8");
  }

  private loadSqlGenerationPrompt(): string {
    const promptPath = join(__dirname, "../../config/build_sql_prompt.md");
    return readFileSync(promptPath, "utf-8");
  }

  private calculateAccuracy(confidence: number, sqlStatus: SqlStatus): number {
    // Accuracy is based on LLM confidence, adjusted by SQL execution status
    switch (sqlStatus) {
      case "success":
        // SQL executed successfully with data - use full confidence
        return confidence;
      case "empty":
        // SQL executed but returned no data - reduce confidence
        return Math.round(confidence * 0.7);
      case "failed":
        // SQL execution failed - significant penalty
        return Math.round(confidence * 0.5);
      case "not_needed":
        // No SQL required - use full confidence
        return confidence;
      default:
        return confidence;
    }
  }

  async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    // Step 1: Get active prompt from database
    const activePrompt = await this.promptService.findActive();
    if (!activePrompt) {
      throw new NoActivePromptError("No active prompt configured");
    }

    // Step 2: Validate model
    const modelInfo = SUPPORTED_MODELS[activePrompt.model];
    if (!modelInfo) {
      throw new UnsupportedModelError(activePrompt.model);
    }

    let queryResults = "";
    let sqlUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let sqlStatus: SqlStatus = "not_needed";
    // SQL generation confidence (used as primary confidence indicator)
    let sqlConfidence = 50; // Default middle of range
    let sqlConfidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let sqlConfidenceReasoning = "SQL generation confidence not available";
    // Debug fields for troubleshooting
    let rawSql: string | null = null;
    let rawResult: unknown = null;

    // Step 3: Try to initialize MCP and query database
    try {
      await this.ensureMcpInitialized();

      // Step 3a: Ask LLM to generate SQL
      const sqlPrompt = this.buildSqlGenerationPrompt(request.question);
      const sqlStartTime = Date.now();
      const sqlResponse = await this.bedrockService.invoke(
        sqlPrompt,
        request.question,
        activePrompt.model
      );
      const sqlDuration = Date.now() - sqlStartTime;
      getSqlGenerationDuration().record(sqlDuration, {
        model: activePrompt.model,
      });

      // Track SQL generation tokens and confidence
      sqlUsage = sqlResponse.usage;
      sqlConfidence = sqlResponse.confidence;
      sqlConfidenceLevel = sqlResponse.confidenceLevel;
      sqlConfidenceReasoning = sqlResponse.confidenceReasoning;

      // Step 3b: Extract and validate SQL
      const sql = this.extractSqlFromResponse(sqlResponse.text);
      rawSql = sql; // Capture extracted SQL for debug output
      logger.info(
        { event: "sql.generated", sql: sql || "NO_QUERY_NEEDED" },
        "Generated SQL"
      );

      if (sql) {
        if (!this.isSelectQuery(sql)) {
          logger.warn(
            { event: "sql.invalid", reason: "not_select_query" },
            "Generated SQL was not a SELECT query, skipping execution"
          );
          sqlStatus = "failed";
        } else {
          // Step 3c: Execute the generated SQL
          try {
            const results = await this.mcpClient.executeQuery(sql);
            rawResult = results; // Capture raw results before truncation
            if (Array.isArray(results) && results.length > 0) {
              sqlStatus = "success";
              queryResults = this.truncateResults(results);
            } else {
              sqlStatus = "empty";
            }
          } catch (execError) {
            logger.error(
              {
                event: "sql.execution_failed",
                error:
                  execError instanceof Error
                    ? execError.message
                    : "Unknown error",
              },
              "SQL execution failed"
            );
            sqlStatus = "failed";
          }
        }
      }
    } catch (error) {
      // Log MCP errors but continue without database data
      logger.error(
        {
          event: "mcp.error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "MCP error (continuing without data)"
      );
      sqlStatus = "failed";
    }

    // Step 4: Build final prompt with data (if available)
    const finalPrompt = this.buildAnswerPrompt(
      this.baseSystemPrompt,
      activePrompt.content,
      queryResults
    );

    // Step 5: Invoke Bedrock to answer the question
    const response = await this.bedrockService.invoke(
      finalPrompt,
      request.question,
      activePrompt.model
    );

    // Step 6: Calculate accuracy using SQL generation confidence
    const answerUsage = response.usage;
    const accuracy = this.calculateAccuracy(sqlConfidence, sqlStatus);

    return {
      answer: response.text,
      confidence: sqlConfidence,
      confidenceLevel: sqlConfidenceLevel,
      confidenceReasoning: sqlConfidenceReasoning,
      accuracy,
      usage: {
        sql: sqlUsage,
        answer: answerUsage,
        total: {
          inputTokens: sqlUsage.inputTokens + answerUsage.inputTokens,
          outputTokens: sqlUsage.outputTokens + answerUsage.outputTokens,
        },
      },
      modelId: activePrompt.model,
      modelName: modelInfo.name,
      promptId: activePrompt.id,
      rawSql,
      rawResult,
      sqlStatus,
    };
  }

  async chatStream(
    request: ChatRequestDto,
    callbacks: StreamChatCallbacks
  ): Promise<void> {
    // Step 1: Get active prompt from database
    const activePrompt = await this.promptService.findActive();
    if (!activePrompt) {
      callbacks.onError(new NoActivePromptError("No active prompt configured"));
      return;
    }

    // Step 2: Validate model
    const modelInfo = SUPPORTED_MODELS[activePrompt.model];
    if (!modelInfo) {
      callbacks.onError(new UnsupportedModelError(activePrompt.model));
      return;
    }

    let queryResults = "";
    let sqlUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let sqlStatus: SqlStatus = "not_needed";
    // SQL generation confidence (used as primary confidence indicator)
    let sqlConfidence = 50; // Default middle of range
    let sqlConfidenceLevel: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let sqlConfidenceReasoning = "SQL generation confidence not available";
    // Debug fields for troubleshooting
    let rawSql: string | null = null;
    let rawResult: unknown = null;

    // Step 3: Try to initialize MCP and query database
    try {
      await this.ensureMcpInitialized();

      // Step 3a: Ask LLM to generate SQL (non-streaming for SQL generation)
      const sqlPrompt = this.buildSqlGenerationPrompt(request.question);
      const sqlStartTime = Date.now();
      const sqlResponse = await this.bedrockService.invoke(
        sqlPrompt,
        request.question,
        activePrompt.model
      );
      const sqlDuration = Date.now() - sqlStartTime;
      getSqlGenerationDuration().record(sqlDuration, {
        model: activePrompt.model,
      });

      // Track SQL generation tokens and confidence
      sqlUsage = sqlResponse.usage;
      sqlConfidence = sqlResponse.confidence;
      sqlConfidenceLevel = sqlResponse.confidenceLevel;
      sqlConfidenceReasoning = sqlResponse.confidenceReasoning;

      // Step 3b: Extract and validate SQL
      const sql = this.extractSqlFromResponse(sqlResponse.text);
      rawSql = sql; // Capture extracted SQL for debug output
      logger.info(
        { event: "sql.generated", sql: sql || "NO_QUERY_NEEDED" },
        "Generated SQL"
      );

      if (sql) {
        if (!this.isSelectQuery(sql)) {
          logger.warn(
            { event: "sql.invalid", reason: "not_select_query" },
            "Generated SQL was not a SELECT query, skipping execution"
          );
          sqlStatus = "failed";
        } else {
          // Step 3c: Execute the generated SQL
          try {
            const results = await this.mcpClient.executeQuery(sql);
            rawResult = results; // Capture raw results before truncation
            if (Array.isArray(results) && results.length > 0) {
              sqlStatus = "success";
              queryResults = this.truncateResults(results);
            } else {
              sqlStatus = "empty";
            }
          } catch (execError) {
            logger.error(
              {
                event: "sql.execution_failed",
                error:
                  execError instanceof Error
                    ? execError.message
                    : "Unknown error",
              },
              "SQL execution failed"
            );
            sqlStatus = "failed";
          }
        }
      }
    } catch (error) {
      // Log MCP errors but continue without database data
      logger.error(
        {
          event: "mcp.error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "MCP error (continuing without data)"
      );
      sqlStatus = "failed";
    }

    // Step 4: Build final prompt with data (if available)
    const finalPrompt = this.buildAnswerPrompt(
      this.baseSystemPrompt,
      activePrompt.content,
      queryResults
    );

    // Step 5: Stream response from Bedrock
    // Use SQL generation confidence (captured above) for the response
    await this.bedrockService.invokeStream(
      finalPrompt,
      request.question,
      activePrompt.model,
      {
        onChunk: callbacks.onChunk,
        onComplete: (answerUsage) => {
          const accuracy = this.calculateAccuracy(sqlConfidence, sqlStatus);
          callbacks.onComplete({
            modelName: modelInfo.name,
            promptId: activePrompt.id,
            confidence: sqlConfidence,
            confidenceLevel: sqlConfidenceLevel,
            confidenceReasoning: sqlConfidenceReasoning,
            accuracy,
            usage: {
              sql: sqlUsage,
              answer: answerUsage,
              total: {
                inputTokens: sqlUsage.inputTokens + answerUsage.inputTokens,
                outputTokens: sqlUsage.outputTokens + answerUsage.outputTokens,
              },
            },
            rawSql,
            rawResult,
            sqlStatus,
          });
        },
        onError: callbacks.onError,
      }
    );
  }

  getAvailableModels(): ModelListDto[] {
    return Object.entries(SUPPORTED_MODELS).map(([id, info]) => ({
      id,
      name: info.name,
      tier: info.tier,
      description: info.description,
    }));
  }
}
