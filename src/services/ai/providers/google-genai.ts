import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIProvider, AIProviderConfig, AIProviderID } from "./types";
import { createRotatingGeminiModel } from "./gemini-rotator";

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
		const modelName = config.model || "gemini-2.5-flash-lite";
		console.log(`[GoogleGenAI] Creating rotating model: ${modelName}`);

		const shouldApplyThinking =
			this.supportsThinkingConfig(modelName) && config.reasoningEnabled;
		const thinkingBudget = 1024;

		return createRotatingGeminiModel({
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
		if (
			!process.env.GOOGLE_API_KEY &&
			!process.env.GOOGLE_API_KEYS &&
			!process.env.GEMINI_API_KEYS
		) {
			return {
				valid: false,
				error: "No Google or Gemini API keys configured in environment",
			};
		}
		return { valid: true };
	}
}
