import { IAgentProvider } from '../interface'
import { AgentStreamParams, StreamEvent } from '../../types/agent.types'
import { streamAgent } from '../../graph'

/**
 * Manual LangGraph Agent Provider
 * Wraps the existing custom StateGraph implementation
 */
export class ManualGraphProvider implements IAgentProvider {
    public readonly id = 'manual_graph'

    async *stream(params: AgentStreamParams): AsyncGenerator<StreamEvent> {
        yield* streamAgent(
            params.message,
            params.documentContent,
            params.documentHTML,
            params.threadId,
            params.conversationHistory,
            params.toolResults,
            params.documentId,
            params.initialPlan,
            params.reasoningEnabled,
            params.providerId,
            params.modelId
        )
    }
}
