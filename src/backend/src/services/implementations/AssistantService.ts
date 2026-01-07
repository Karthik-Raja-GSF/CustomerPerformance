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
} from "@/contracts/dtos/assistant.dto";
import { SUPPORTED_MODELS } from "@/contracts/models/assistant.model";
import {
  NoActivePromptError,
  UnsupportedModelError,
} from "@/utils/errors/assistant-errors";
import { getSqlGenerationDuration } from "@/telemetry/metrics";

@injectable()
export class AssistantService implements IAssistantService {
  private baseSystemPrompt: string;
  private sqlGenerationPromptTemplate: string;
  private mcpInitialized = false;
  private cachedSchema: string | null = null;

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

  private async getSchemaInfo(): Promise<string> {
    if (this.cachedSchema) {
      return this.cachedSchema;
    }
    this.cachedSchema = await this.mcpClient.getSchemaInfo();
    return this.cachedSchema;
  }

  private buildSqlGenerationPrompt(schema: string, question: string): string {
    return this.sqlGenerationPromptTemplate
      .replace("{{schema}}", schema)
      .replace("{{question}}", question);
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

    // Step 3: Try to initialize MCP and query database
    try {
      await this.ensureMcpInitialized();
      const schemaInfo = await this.getSchemaInfo();

      // Step 3a: Ask LLM to generate SQL
      const sqlPrompt = this.buildSqlGenerationPrompt(
        schemaInfo,
        request.question
      );
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

      // Step 3b: Extract and validate SQL
      const sql = this.extractSqlFromResponse(sqlResponse.text);

      if (sql) {
        if (!this.isSelectQuery(sql)) {
          console.warn(
            "Generated SQL was not a SELECT query, skipping execution"
          );
        } else {
          // Step 3c: Execute the generated SQL
          const results = await this.mcpClient.executeQuery(sql);
          queryResults = this.truncateResults(results);
        }
      }
    } catch (error) {
      // Log MCP errors but continue without database data
      console.error(
        "MCP error (continuing without data):",
        error instanceof Error ? error.message : error
      );
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

    // Step 6: Return response
    return {
      answer: response.text,
      confidence: response.confidence,
      usage: response.usage,
      modelId: activePrompt.model,
      modelName: modelInfo.name,
      promptId: activePrompt.id,
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

    // Step 3: Try to initialize MCP and query database
    try {
      await this.ensureMcpInitialized();
      const schemaInfo = await this.getSchemaInfo();

      // Step 3a: Ask LLM to generate SQL (non-streaming for SQL generation)
      const sqlPrompt = this.buildSqlGenerationPrompt(
        schemaInfo,
        request.question
      );
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

      // Step 3b: Extract and validate SQL
      const sql = this.extractSqlFromResponse(sqlResponse.text);

      if (sql) {
        if (!this.isSelectQuery(sql)) {
          console.warn(
            "Generated SQL was not a SELECT query, skipping execution"
          );
        } else {
          // Step 3c: Execute the generated SQL
          const results = await this.mcpClient.executeQuery(sql);
          queryResults = this.truncateResults(results);
        }
      }
    } catch (error) {
      // Log MCP errors but continue without database data
      console.error(
        "MCP error (continuing without data):",
        error instanceof Error ? error.message : error
      );
    }

    // Step 4: Build final prompt with data (if available)
    const finalPrompt = this.buildAnswerPrompt(
      this.baseSystemPrompt,
      activePrompt.content,
      queryResults
    );

    // Step 5: Stream response from Bedrock
    await this.bedrockService.invokeStream(
      finalPrompt,
      request.question,
      activePrompt.model,
      {
        onChunk: callbacks.onChunk,
        onComplete: (usage) => {
          callbacks.onComplete({
            modelName: modelInfo.name,
            promptId: activePrompt.id,
            usage,
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
