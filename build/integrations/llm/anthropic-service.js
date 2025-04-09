import { Anthropic } from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY } from "../../config/environment.js";
export class AnthropicService {
    client;
    constructor() {
        this.client = new Anthropic({
            apiKey: ANTHROPIC_API_KEY,
        });
    }
    async processMessages(messages) {
        const response = await this.client.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages,
        });
        return response;
    }
    async processMessagesWithTools(messages, tools) {
        const response = await this.client.messages.create({
            model: "claude-3-opus-20240229",
            max_tokens: 1000,
            messages,
            tools,
        });
        return response;
    }
}
