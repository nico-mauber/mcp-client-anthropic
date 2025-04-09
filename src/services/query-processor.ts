import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";
import { ILlmService, IMcpServerManager, IQueryProcessor } from "../types/index.js";

export class QueryProcessor implements IQueryProcessor {
  private llmService: ILlmService;
  private mcpServerManager: IMcpServerManager;

  constructor(llmService: ILlmService, mcpServerManager: IMcpServerManager) {
    this.llmService = llmService;
    this.mcpServerManager = mcpServerManager;
  }

  /**
   * Procesa una consulta de usuario utilizando LLM y servidores MCP
   */
  public async processQuery(query: string): Promise<string> {
    // Preparar el mensaje del usuario
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "user",
        content: query,
      },
    ];

    // Obtener todas las herramientas disponibles
    const allTools = this.mcpServerManager.getAllTools();

    // Llamar al LLM con las herramientas disponibles
    const response = await this.llmService.processMessagesWithTools(messages, allTools);
    
    const finalText: string[] = [];

    // Verificar si el modelo quiere usar alguna herramienta
    if (
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message.tool_calls
    ) {
      const toolCalls = response.choices[0].message.tool_calls;

      for (const toolCall of toolCalls) {
        if (toolCall.type === "function") {
          // Identificar qué herramienta desea usar
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          // Obtener el cliente MCP correspondiente
          const serverClient = this.mcpServerManager.getServerByToolName(toolName);
          
          if (!serverClient) {
            finalText.push(`No server found for tool ${toolName}`);
            continue;
          }

          // Llamar a la herramienta en el servidor correspondiente
          const result = await serverClient.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          // Registrar el uso de la herramienta en la conversación
          messages.push({
            role: "assistant",
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

          // Registrar la respuesta de la herramienta
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.content as string,
          });
        }
      }

      // Solicitar al modelo una respuesta final con la información recopilada
      const followUp = await this.llmService.processMessages(messages);

      if (
        followUp.choices &&
        followUp.choices.length > 0 &&
        followUp.choices[0].message.content
      ) {
        finalText.push(followUp.choices[0].message.content);
      }
    } else if (
      response.choices &&
      response.choices.length > 0 &&
      response.choices[0].message.content
    ) {
      // Si el modelo no quiso usar herramientas, simplemente devolvemos su respuesta
      finalText.push(response.choices[0].message.content);
    }

    return finalText.join("\n");
  }
}
