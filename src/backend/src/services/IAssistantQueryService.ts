export const ASSISTANT_QUERY_SERVICE_TOKEN = Symbol.for(
  "AssistantQueryService"
);

export interface IAssistantQueryService {
  initialize(): Promise<void>;
  executeQuery(sql: string): Promise<unknown>;
  getSchemaInfo(): Promise<string>;
  disconnect(): Promise<void>;
}
