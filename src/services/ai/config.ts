import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIProviderID, AIProviderConfig } from './providers/types'
import { aiRegistry } from './providers/registry'

/**
 * AI Provider types
 */
export type AIProvider = AIProviderID

/**
 * AI Configuration interface
 */
export interface AIConfig extends AIProviderConfig {
	provider: AIProvider
}

/**
 * Get AI configuration from environment variables
 */
export const getAIConfig = (): AIConfig => {
	return {
		provider: (process.env.AI_PROVIDER as AIProvider) || 'google-genai',
		model: process.env.AI_MODEL || 'gemini-2.5-flash',
		temperature: Number(process.env.AI_TEMPERATURE) || 0.7,
		maxTokens: Number(process.env.AI_MAX_TOKENS) || 8192,
		streaming: true,
		reasoningEnabled: false,
	}
}

/**
 * Create AI model instance based on provider
 */
export const createAIModel = (config?: Partial<AIConfig>): BaseChatModel => {
	const fullConfig = { ...getAIConfig(), ...config }
	const provider = aiRegistry.getProvider(fullConfig.provider)

	return provider.createModel({
		model: fullConfig.model,
		temperature: fullConfig.temperature,
		maxTokens: fullConfig.maxTokens,
		streaming: fullConfig.streaming,
		reasoningEnabled: Boolean(fullConfig.reasoningEnabled),
	})
}

/**
 * Get available models for current provider
 */
export const getAvailableModels = (providerId?: AIProvider): string[] => {
	const id = providerId || getAIConfig().provider
	const provider = aiRegistry.getProvider(id)
	return provider.getAvailableModels()
}

/**
 * Validate API credentials
 */
export const validateAICredentials = (providerId?: AIProviderID): { valid: boolean; error?: string } => {
	const config = getAIConfig()
	const targetProviderId = providerId || config.provider
	const provider = aiRegistry.getProvider(targetProviderId)
	return provider.validateCredentials()
}

/**
 * Get all supported providers
 */
export const getSupportedProviders = () => {
	return aiRegistry.getAllProviders().map(p => ({
		id: p.id,
		name: p.name
	}))
}
