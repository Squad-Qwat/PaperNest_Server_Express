import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatMistralAI } from "@langchain/mistralai";
import type { AIProvider, AIProviderConfig, AIProviderID } from "./types";

export class MistralAIProvider implements AIProvider {
	id: AIProviderID = "mistral-ai";
	name = "Mistral AI";

	createModel(config: AIProviderConfig): BaseChatModel {
		const apiKey = process.env.MISTRAL_API_KEY;

		if (!apiKey) {
			throw new Error("MISTRAL_API_KEY is not set");
		}

		return new ChatMistralAI({
			apiKey,
			model: config.model,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
			streaming: config.streaming,
		});
	}

	getAvailableModels(): string[] {
		return [
			"mistral-large-latest",
			"mistral-medium-latest",
			"mistral-small-latest",
			"open-mixtral-8x7b",
			"mistral-tiny",
		];
	}

	validateCredentials(): { valid: boolean; error?: string } {
		if (!process.env.MISTRAL_API_KEY) {
			return { valid: false, error: "MISTRAL_API_KEY is not set" };
		}
		return { valid: true };
	}
}
