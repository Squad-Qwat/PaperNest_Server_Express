/**
 * AI Agent Shared Utilities
 * 
 * Centralizes common helper functions to ensure DRY principles and consistent behavior.
 */

import { createCodeMirrorTools } from './tools/schemas'

/**
 * Converts various AI message content formats (string, parts array) to plain text.
 */
export const contentToText = (content: unknown): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .map((part: any) => (part?.type === 'text' ? part.text : ''))
            .filter(Boolean)
            .join('')
    }
    if (content === null || content === undefined) return ''
    try {
        return JSON.stringify(content)
    } catch {
        return '[unserializable-content]'
    }
}

/**
 * Robustly extracts token usage from model response metadata.
 * Handles different naming conventions across Google GenAI models.
 */
export const extractTokenMetadata = (usage: any = {}) => {
    return {
        inputTokens: usage.prompt_token_count ?? usage.promptTokens ?? usage.input_tokens ?? 0,
        outputTokens: usage.candidates_token_count ?? usage.output_tokens ?? usage.completionTokens ?? usage.total_token_count ?? usage.total_tokens ?? 0,
        reasoningTokens: usage.thinking_token_count ?? usage.reasoning_tokens ?? 0
    }
}

/**
 * Generates a formatted list of available tools and their descriptions.
 * Used for system prompt injection.
 */
export const getToolDescriptions = (): string => {
    const tools = createCodeMirrorTools()
    return tools
        .map((t) => `- **${t.name}**: ${t.description}`)
        .join('\n')
}
