import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type AIProviderID = "google-genai" | "vertex-ai" | "mistral-ai";

export interface AIProviderConfig {
	model: string;
	temperature: number;
	maxTokens: number;
	streaming: boolean;
	reasoningEnabled?: boolean;
}

export interface AIProvider {
	id: AIProviderID;
	name: string;
	createModel(config: AIProviderConfig): BaseChatModel;
	getAvailableModels(): string[];
	validateCredentials(): { valid: boolean; error?: string };
}
