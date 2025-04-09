import OpenAI from "openai";
import { OPENAI_API_KEY } from "../../config/environment.js";
export class OpenAIService {
    client;
    constructor() {
        this.client = new OpenAI({
            apiKey: OPENAI_API_KEY,
        });
    }
    async processMessages(messages) {
        const response = await this.client.chat.completions.create({
            model: "gpt-4",
            max_tokens: 1000,
            messages,
        });
        return response;
    }
    async processMessagesWithTools(messages, tools) {
        const response = await this.client.chat.completions.create({
            model: "gpt-3.5-turbo-0125",
            max_tokens: 1000,
            messages,
            tools: tools.map((tool) => ({
                type: "function",
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
