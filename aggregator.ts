import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve("build", ".env") });

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  throw new Error("key is not set");
}

// Estructura para mantener la información de un servidor MCP
interface McpServerConnection {
  client: Client;
  toolNames: Set<string>; // para identificar rápidamente a qué servidor pertenece cada tool
}

export class AggregatorClient {
  private anthropic: Anthropic;
  private weatherServer: McpServerConnection | null = null;
  private dictionaryServer: McpServerConnection | null = null;
  private allTools: Tool[] = [];

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: key,
    });
  }

  /**
   * Inicia un servidor MCP y almacena la conexión.
   * @param serverScriptPath Path del archivo del servidor (por ej: weather.js, spanish-dictionary.js)
   * @param serverKey Identificador interno (ej: "weather" o "dictionary")
   */
  private async startSingleServer(serverScriptPath: string, serverKey: "weather" | "dictionary") {
    const client = new Client({ name: `mcp-${serverKey}-client`, version: "1.0.0" });

    // Determina el comando a usar
    const isJs = serverScriptPath.endsWith(".js");
    const isPy = serverScriptPath.endsWith(".py");
    if (!isJs && !isPy) {
      throw new Error("Server script must be a .js or .py file");
    }
    const command = isPy
      ? process.platform === "win32"
        ? "python"
        : "python3"
      : process.execPath;

    // Crea el transporte Stdio
    const transport = new StdioClientTransport({
      command,
      args: [serverScriptPath],
    });

    // Conecta el cliente al servidor
    client.connect(transport);

    // Obtiene las herramientas
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    })) as Tool[];

    console.log(`Conectado a ${serverKey} con tools:`, tools.map(({ name }) => name));

    // Guarda la conexión
    const connection: McpServerConnection = {
      client,
      toolNames: new Set(tools.map(t => t.name)),
    };

    // Dependiendo del serverKey, guardamos en la variable adecuada
    if (serverKey === "weather") {
      this.weatherServer = connection;
    } else {
      this.dictionaryServer = connection;
    }

    // Agregamos estas herramientas a la lista total
    this.allTools.push(...tools);
  }

  /**
   * Arranca ambos servidores MCP: weather y dictionary
   */
  public async startAllServers(weatherPath: string, dictionaryPath: string) {
    await this.startSingleServer(weatherPath, "weather");
    await this.startSingleServer(dictionaryPath, "dictionary");
  }

  /**
   * Lógica principal que procesa cada consulta del usuario.
   */
  public async processQuery(query: string) {
    // Mensaje del usuario
    const messages: MessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];

    // Llamamos a Anthropic con la lista combinada de herramientas
    const response = await this.anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages,
      tools: this.allTools
    }, 
      {headers: {
        "anthropic-beta": "token-efficient-tools-2025-02-19"
      }}
    );

    const finalText = [];
    debugger;
    // Revisamos si el modelo quiere usar alguna herramienta
    for (const content of response.content) {
      if (content.type === "text") {
        finalText.push(content.text);
      } else if (content.type === "tool_use") {
        // Identificamos qué herramienta desea usar
        const toolName = content.name;
        const toolArgs = content.input as { [x: string]: unknown } | undefined;

        // Decidimos a qué servidor dirigir la llamada
        let serverClienteToUse: Client | null = null;
        if (this.weatherServer?.toolNames.has(toolName)) {
          serverClienteToUse = this.weatherServer.client;
        } else if (this.dictionaryServer?.toolNames.has(toolName)) {
          serverClienteToUse = this.dictionaryServer.client;
        } else {
          // Si no coincide con ninguno, devolvemos error
          finalText.push(`No server found for tool ${toolName}`);
          continue;
        }

        // Llamamos a la herramienta en el servidor correspondiente
        const result = await serverClienteToUse.callTool({
          name: toolName,
          arguments: toolArgs,
        });

        finalText.push(
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );

        // Incorporamos la respuesta del servidor como si fuera un "mensaje" para el modelo
        messages.push({
          role: "user",
          content: result.content as string,
        });

        // Pedimos al modelo que genere una respuesta final, usando la info del servidor
        const followUp = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages,
        });

        if (followUp.content.length > 0 && followUp.content[0].type === "text") {
          finalText.push(followUp.content[0].text);
        }
      }
    }

    return finalText.join("\n");
  }

  /**
   * Bucle de lectura en consola para consultas interactivas.
   */
  public async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log("\nAggregator MCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          break;
        }
        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } 
    catch (error) {
      console.error("Error en el bucle de lectura:", error);
    }
    finally {
      rl.close();
    }
  }

  /**
   * Cierra las conexiones con los servidores MCP.
   */
  public async cleanup() {
    if (this.weatherServer) {
      await this.weatherServer.client.close();
    }
    if (this.dictionaryServer) {
      await this.dictionaryServer.client.close();
    }
  }
}

