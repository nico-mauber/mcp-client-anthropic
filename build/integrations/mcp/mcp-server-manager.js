import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
export class McpServerManager {
    servers = new Map();
    allTools = [];
    /**
     * Inicia un servidor MCP y almacena la conexión.
     * @param serverScriptPath Path del archivo del servidor
     * @param serverType Tipo de servidor a iniciar
     */
    async startServer(serverScriptPath, serverType) {
        const client = new Client({
            name: `mcp-${serverType}-client`,
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
        console.log(`Conectado a ${serverType} con tools:`, tools.map(({ name }) => name));
        // Guarda la conexión
        const connection = {
            client,
            toolNames: new Set(tools.map((t) => t.name)),
        };
        // Almacena la conexión en el mapa
        this.servers.set(serverType, connection);
        // Agrega las herramientas a la lista total
        this.allTools.push(...tools);
        return connection;
    }
    /**
     * Busca el cliente MCP asociado a una herramienta específica
     */
    getServerByToolName(toolName) {
        for (const [_, connection] of this.servers.entries()) {
            if (connection.toolNames.has(toolName)) {
                return connection.client;
            }
        }
        return null;
    }
    /**
     * Devuelve todas las herramientas disponibles de todos los servidores
     */
    getAllTools() {
        return this.allTools;
    }
    /**
     * Cierra todas las conexiones con los servidores MCP
     */
    async cleanup() {
        const promises = [];
        for (const [_, connection] of this.servers.entries()) {
            promises.push(connection.client.close());
        }
        await Promise.all(promises);
        // Limpia las colecciones
        this.servers.clear();
        this.allTools = [];
    }
}
