import { GoogleGenAIProvider } from "./google-genai";
import { MistralAIProvider } from "./mistral-ai";
import type { AIProvider, AIProviderID } from "./types";
import { VertexAIProvider } from "./vertex-ai";

class AIProviderRegistry {
	private providers: Map<AIProviderID, AIProvider> = new Map();

	constructor() {
		this.register(new GoogleGenAIProvider());
		this.register(new VertexAIProvider());
		this.register(new MistralAIProvider());
	}

	register(provider: AIProvider) {
		this.providers.set(provider.id, provider);
	}

	getProvider(id: AIProviderID): AIProvider {
		const provider = this.providers.get(id);
		if (!provider) {
			throw new Error(`AI Provider "${id}" not found in registry`);
		}
		return provider;
	}

	getAllProviders(): AIProvider[] {
		return Array.from(this.providers.values());
	}
}

export const aiRegistry = new AIProviderRegistry();
