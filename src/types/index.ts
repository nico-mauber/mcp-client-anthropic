import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Definición de interfaces comunes para toda la aplicación

export interface IMcpServerConnection {
  client: Client;
  toolNames: Set<string>;
}

export interface IMcpTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface ILlmService {
  processMessages(messages: any[]): Promise<any>;
  processMessagesWithTools(messages: any[], tools: Tool[]): Promise<any>;
}

export type ServerType = "weather" | "dictionary";

export interface IMcpServerManager {
  startServer(serverScriptPath: string, serverType: ServerType): Promise<IMcpServerConnection>;
  getServerByToolName(toolName: string): Client | null;
  getAllTools(): Tool[];
  cleanup(): Promise<void>;
}

export interface IQueryProcessor {
  processQuery(query: string): Promise<string>;
}