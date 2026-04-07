import { ChatVertexAI } from '@langchain/google-vertexai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AIProvider, AIProviderConfig, AIProviderID } from './types'

export class VertexAIProvider implements AIProvider {
	id: AIProviderID = 'vertex-ai'
	name = 'Google Vertex AI'

	createModel(config: AIProviderConfig): BaseChatModel {
		const projectId = process.env.VERTEX_AI_PROJECT_ID
		const location = process.env.VERTEX_AI_LOCATION || 'us-central1'

		if (!projectId) {
			throw new Error('VERTEX_AI_PROJECT_ID is not set')
		}

		return new ChatVertexAI({
			model: config.model,
			temperature: config.temperature,
			maxOutputTokens: config.maxTokens,
			streaming: config.streaming,
			authOptions: {
				projectId,
			},
			platformType: 'gcp',
			location,
		})
	}

	getAvailableModels(): string[] {
		return [
			'gemini-2.5-flash',
			'gemini-1.5-pro-002',
			'gemini-1.5-flash-002',
			'gemini-1.0-pro-002',
		]
	}

	validateCredentials(): { valid: boolean; error?: string } {
		if (!process.env.VERTEX_AI_PROJECT_ID) {
			return { valid: false, error: 'VERTEX_AI_PROJECT_ID is not set' }
		}
		return { valid: true }
	}
}
