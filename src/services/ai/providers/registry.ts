import type { AIProvider, AIProviderID } from './types'
import { GoogleGenAIProvider } from './google-genai'
import { VertexAIProvider } from './vertex-ai'
import { MistralAIProvider } from './mistral-ai'

class AIProviderRegistry {
	private providers: Map<AIProviderID, AIProvider> = new Map()

	constructor() {
		this.register(new GoogleGenAIProvider())
		this.register(new VertexAIProvider())
		this.register(new MistralAIProvider())
	}

	register(provider: AIProvider) {
		this.providers.set(provider.id, provider)
	}

	getProvider(id: AIProviderID): AIProvider {
		const provider = this.providers.get(id)
		if (!provider) {
			throw new Error(`AI Provider "${id}" not found in registry`)
		}
		return provider
	}

	getAllProviders(): AIProvider[] {
		return Array.from(this.providers.values())
	}
}

export const aiRegistry = new AIProviderRegistry()
