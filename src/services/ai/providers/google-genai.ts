import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { AIProvider, AIProviderConfig, AIProviderID } from "./types";

export class GoogleGenAIProvider implements AIProvider {
	id: AIProviderID = "google-genai";
	name = "Google Gemini";

	private supportsThinkingConfig(modelName: string): boolean {
		const normalized = modelName.toLowerCase();
		return (
			normalized.includes("gemini-2.5") ||
			normalized.includes("gemini-3") ||
			normalized.includes("gemma-4")
		);
	}

	createModel(config: AIProviderConfig): BaseChatModel {
		const apiKey = process.env.GOOGLE_API_KEY;

		if (!apiKey) {
			throw new Error("GOOGLE_API_KEY is not set");
		}

		const modelName = config.model || "gemini-2.5-flash-lite";
		console.log(`[GoogleGenAI] Creating model: ${modelName}`);

		const shouldApplyThinking =
			this.supportsThinkingConfig(modelName) && config.reasoningEnabled;
		const thinkingBudget = 1024; // Minimum is 512, using 1024 as default for reasoning

		return new ChatGoogleGenerativeAI({
			apiKey,
			model: modelName,
			temperature: config.temperature,
			maxOutputTokens: config.maxTokens,
			streaming: config.streaming,
			...(shouldApplyThinking
				? {
						thinkingConfig: {
							includeThoughts: true,
							thinkingBudget,
						},
					}
				: {}),
		});
	}

	getAvailableModels(): string[] {
		return [
			"gemma-4-31b-it",
			"gemini-3.1-flash-lite-preview",
			"gemini-2.5-flash",
			"gemini-2.5-flash-lite",
		];
	}

	validateCredentials(): { valid: boolean; error?: string } {
		if (!process.env.GOOGLE_API_KEY) {
			return { valid: false, error: "GOOGLE_API_KEY is not set" };
		}
		return { valid: true };
	}
}
