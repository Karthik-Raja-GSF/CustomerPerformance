export const MCP_CLIENT_SERVICE_TOKEN = Symbol.for('McpClientService');

export interface IMcpClientService {
  initialize(): Promise<void>;
  executeQuery(sql: string): Promise<unknown>;
  getSchemaInfo(): Promise<string>;
  disconnect(): Promise<void>;
}
