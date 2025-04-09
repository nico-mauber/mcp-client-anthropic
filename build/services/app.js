import { ApiServer } from "../api/server.js";
import { WEATHER_SERVER_PATH, DICTIONARY_SERVER_PATH } from "../config/paths.js";
import { McpServerManager } from "../integrations/mcp/mcp-server-manager.js";
import { OpenAIService } from "../integrations/llm/openai-service.js";
import { QueryProcessor } from "./query-processor.js";
export class Application {
    apiServer;
    mcpServerManager;
    llmService;
    queryProcessor;
    constructor() {
        // Inicializar componentes
        this.mcpServerManager = new McpServerManager();
        this.llmService = new OpenAIService();
        this.queryProcessor = new QueryProcessor(this.llmService, this.mcpServerManager);
        this.apiServer = new ApiServer(this.queryProcessor);
    }
    /**
     * Arranca la aplicación completa, incluyendo servidores MCP y API REST
     */
    async start() {
        try {
            console.log("Iniciando servidores MCP (Weather y Dictionary)...");
            await this.mcpServerManager.startServer(WEATHER_SERVER_PATH, "weather");
            await this.mcpServerManager.startServer(DICTIONARY_SERVER_PATH, "dictionary");
            console.log("Servidores MCP iniciados correctamente.");
            // Configurar y arrancar el servidor API
            await this.apiServer.start();
            // Configurar manejadores de cierre
            this.apiServer.setupShutdownHandlers(() => this.mcpServerManager.cleanup());
        }
        catch (error) {
            console.error("Error crítico durante la inicialización:", error);
            await this.cleanup();
            process.exit(1);
        }
    }
    /**
     * Limpia los recursos antes de cerrar la aplicación
     */
    async cleanup() {
        try {
            await this.mcpServerManager.cleanup();
        }
        catch (error) {
            console.error("Error durante la limpieza:", error);
        }
    }
}
