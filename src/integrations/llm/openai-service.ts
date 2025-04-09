import OpenAI from "openai";
import { OPENAI_API_KEY } from "../../config/environment.js";
import { Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";
import { ILlmService } from "../../types/index.js";

export class OpenAIService implements ILlmService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }

  async processMessages(messages: ChatCompletionMessageParam[]): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: "gpt-4",
      max_tokens: 1000,
      messages,
    });

    return response;
  }

  async processMessagesWithTools(messages: ChatCompletionMessageParam[], tools: Tool[]): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      max_tokens: 1000,
      messages,
      tools: tools.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })),
    });

    return response;
  }
}
