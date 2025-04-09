import { Anthropic } from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "../../config/environment.js";
import { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { ILlmService } from "../../types/index.js";

export class AnthropicService implements ILlmService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }

  async processMessages(messages: MessageParam[]): Promise<any> {
    const response = await this.client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages,
    });

    return response;
  }

  async processMessagesWithTools(messages: MessageParam[], tools: Tool[]): Promise<any> {
    const response = await this.client.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages,
      tools,
    });

    return response;
  }
}
