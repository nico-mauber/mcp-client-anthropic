import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline/promises";
import dotenv from "dotenv";
import path from "path";
import OpenAI from "openai";
dotenv.config({ path: path.resolve("build", ".env") });
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
}
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
}
export class AggregatorClient {
    openAI;
    weatherServer = null;
    dictionaryServer = null;
    allTools = [];
    constructor() {
        this.openAI = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });
    }
    /**
     * Inicia un servidor MCP y almacena la conexión.
     * @param serverScriptPath Path del archivo del servidor (por ej: weather.js, spanish-dictionary.js)
     * @param serverKey Identificador interno (ej: "weather" o "dictionary")
     */
    async startSingleServer(serverScriptPath, serverKey) {
        const client = new Client({
            name: `mcp-${serverKey}-client`,
            version: "1.0.0",
        });
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
        }));
        console.log(`Conectado a ${serverKey} con tools:`, tools.map(({ name }) => name));
        // Guarda la conexión
        const connection = {
            client,
            toolNames: new Set(tools.map((t) => t.name)),
        };
        // Dependiendo del serverKey, guardamos en la variable adecuada
        if (serverKey === "weather") {
            this.weatherServer = connection;
        }
        else {
            this.dictionaryServer = connection;
        }
        // Agregamos estas herramientas a la lista total
        this.allTools.push(...tools);
    }
    /**
     * Arranca ambos servidores MCP: weather y dictionary
     */
    async startAllServers(weatherPath, dictionaryPath) {
        await this.startSingleServer(weatherPath, "weather");
        await this.startSingleServer(dictionaryPath, "dictionary");
    }
    /**
     * Lógica principal que procesa cada consulta del usuario.
     */
    async processQuery(query) {
        // Mensaje del usuario
        const messages = [
            {
                role: "user",
                content: query,
            },
        ];
        // Llamamos a OpenAI con la lista combinada de herramientas
        const response = await this.openAI.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            max_tokens: 1000,
            messages,
            tools: this.allTools.map((tool) => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.input_schema,
                },
            })),
        });
        const finalText = [];
        // Revisamos si el modelo quiere usar alguna herramienta
        if (response.choices &&
            response.choices.length > 0 &&
            response.choices[0].message.tool_calls) {
            const toolCalls = response.choices[0].message.tool_calls;
            for (const toolCall of toolCalls) {
                if (toolCall.type === "function") {
                    // Identificamos qué herramienta desea usar
                    const toolName = toolCall.function.name;
                    const toolArgs = JSON.parse(toolCall.function.arguments);
                    // Decidimos a qué servidor dirigir la llamada
                    let serverClienteToUse = null;
                    if (this.weatherServer?.toolNames.has(toolName)) {
                        serverClienteToUse = this.weatherServer.client;
                    }
                    else if (this.dictionaryServer?.toolNames.has(toolName)) {
                        serverClienteToUse = this.dictionaryServer.client;
                    }
                    else {
                        // Si no coincide con ninguno, devolvemos error
                        finalText.push(`No server found for tool ${toolName}`);
                        continue;
                    }
                    // Llamamos a la herramienta en el servidor correspondiente
                    const result = await serverClienteToUse.callTool({
                        name: toolName,
                        arguments: toolArgs,
                    });
                    //Yo como LLM pedi que llamen a esta tool con ciertos parametros -  ES UN LOG
                    messages.push({
                        role: "assistant", //Es la respuesta del LLM diciendo que tool ejecutar y con que parametros
                        content: null,
                        tool_calls: [
                            {
                                type: "function",
                                id: toolCall.id,
                                function: {
                                    name: toolName,
                                    arguments: JSON.stringify(toolArgs),
                                },
                            },
                        ],
                    });
                    messages.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: result.content,
                    });
                    // Pedimos al modelo que genere una respuesta final, usando la info del servidor
                }
            }
            const followUp = await this.openAI.chat.completions.create({
                model: "gpt-4",
                max_tokens: 1000,
                messages,
            });
            if (followUp.choices &&
                followUp.choices.length > 0 &&
                followUp.choices[0].message.content) {
                finalText.push(followUp.choices[0].message.content);
            }
        }
        else if (response.choices &&
            response.choices.length > 0 &&
            response.choices[0].message.content) {
            finalText.push(response.choices[0].message.content);
        }
        return finalText.join("\n");
    }
    /**
     * Bucle de lectura en consola para consultas interactivas.
     */
    async chatLoop() {
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
    async cleanup() {
        if (this.weatherServer) {
            await this.weatherServer.client.close();
        }
        if (this.dictionaryServer) {
            await this.dictionaryServer.client.close();
        }
    }
}
