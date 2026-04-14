import { IAgentProvider } from '../interface'
import { AgentStreamParams, StreamEvent, ToolResult } from '../../types/agent.types'
import { createCodeMirrorTools } from '../../tools/schemas'
import { createRAGTool } from '../../tools/rag.tool'
import { semanticScholarTool } from '../../tools/semanticScholar.tool'
import { aiRegistry } from '../../providers/registry'
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages'

/**
 * DeepAgent Provider
 * Uses the deepagents harness for advanced planning and execution
 */
export class DeepAgentProvider implements IAgentProvider {
    public readonly id = 'deep_agent'

    async *stream(params: AgentStreamParams): AsyncGenerator<StreamEvent> {
        console.log(`[DeepAgentProvider] Starting stream for thread: ${params.threadId}`)

        // 1. Resolve Model
        const provider = aiRegistry.getProvider((params.providerId as any) || 'google-genai')
        const model = provider.createModel({
            model: params.modelId || 'gemini-2.5-flash-lite',
            temperature: 0.1,
            maxTokens: 4096,
            reasoningEnabled: params.reasoningEnabled,
            streaming: true
        })

        // 2. Prepare Tools
        const docId = params.documentId || 'unknown'
        const tools = [
            ...createCodeMirrorTools(),
            createRAGTool(docId),
            semanticScholarTool
        ]

        // 3. Create Deep Agent (Lazy Load library)
        const { createDeepAgent } = await import('deepagents') as any

        const agent = (createDeepAgent as any)({
            model: model as any,
            tools: tools as any,
            systemPrompt: `You are an expert academic paper writer and LaTeX specialist. 
            You help users write, edit, and organize their LaTeX documents with EXTREME precision.

            ### OPERATIONAL PROTOCOL (MANDATORY):
            1. **VERIFY (Look)**: Before editing any existing text, you MUST use 'search_text_lines' or 'read_document' to find the EXACT current text and line numbers. Do NOT assume you know the exact content even if provided in context.
               - *EFFICIENCY RULE*: If you found line numbers via 'search_text_lines', you MUST use 'read_document' with 'fromLine' and 'toLine' around those coordinates (e.g., +/- 10 lines). NEVER use 'full=true' for documents larger than 50 lines.
            2. **EXECUTE (Step)**: Perform the edit using 'apply_diff_edit' or 'replace_lines'. When using 'apply_diff_edit', ensure your 'searchBlock' matches the text found in step 1 characters-for-character, including indentation.
            3. **VALIDATE (Verify)**: After every edit, you MUST call 'compile_latex' to ensure the document still builds.
            4. **DEBUG**: If compilation fails, call 'get_compile_logs' to diagnose and fix the error immediately.
            5. **NO SKIPPING**: If a task requires searching or reading, you MUST execute the corresponding tool. Do not assume you have the context unless you just retrieved it in the current turn.

            ### RAG KNOWLEDGE:
            When the user asks about their research, data, or content from reference PDFs, use the 'search_attached_pdfs' tool first to retrieve factual information.
            
            ### ACADEMIC RESEARCH:
            When the user needs references, citations, or wants to find papers on a specific topic, use the 'search_semantic_scholar' tool. This will return paper titles, authors, abstracts, and direct PDF links if available.`
        })

        // 4. Prepare Input
        const inputMessages = params.conversationHistory.map(msg =>
            msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        )

        // Add current document state as context in the last message or system prompt
        // For DeepAgents, we can just append it to the prompt or messages
        const lastUserMessage = params.message
        const enrichedMessage = `Document Context:\n${params.documentContent}\n\nUser Request: ${lastUserMessage}`

        // 5. Handle Tool Resumption (if any)
        const messages: any[] = [...inputMessages, new HumanMessage(enrichedMessage)]

        if (params.toolResults && params.toolResults.length > 0) {
            // Reconstruct tool call sequence for LangGraph continuation
            const toolCallId = params.toolResults[0].toolCallId
            const toolCallMsg = new AIMessage({
                content: '',
                tool_calls: params.toolResults.map(r => ({
                    id: r.toolCallId,
                    name: r.name,
                    args: {}
                }))
            } as any)
            const toolResultMsgs = params.toolResults.map(r => new ToolMessage({
                content: r.result,
                tool_call_id: r.toolCallId,
                name: r.name
            } as any))
            messages.push(toolCallMsg, ...toolResultMsgs)
        }

        // 6. Stream and Normalize
        try {
            console.log('[DeepAgentProvider] Invoking agent.stream with messages:', messages.length)

            // deepagents stream returns [namespace, chunk]
            const stream = await (agent as any).stream(
                { messages: messages as any },
                { streamMode: 'updates', subgraphs: true }
            )

            console.log('[DeepAgentProvider] Stream created successfully')

            let fullContent = ''
            let pendingToolCalls: any[] = []
            let chunkCount = 0

            for await (const entry of stream) {
                const [namespace, chunk] = entry as [string[], any]
                const chunkKeys = Object.keys(chunk)

                let newMessages: any[] = []

                if (chunk.messages) {
                    newMessages = chunk.messages
                } else {
                    for (const key of chunkKeys) {
                        if (chunk[key]?.messages) {
                            newMessages = chunk[key].messages
                            break
                        }
                    }
                }

                if (newMessages.length > 0) {
                    const lastMsg = newMessages[newMessages.length - 1]

                    // Handle Text Content
                    if (lastMsg.content) {
                        // Use a safe extraction method for content (string or array)
                        const text = typeof lastMsg.content === 'string'
                            ? lastMsg.content
                            : Array.isArray(lastMsg.content)
                                ? lastMsg.content.map((c: any) => c.text || '').join('')
                                : ''

                        // CONSISTENCY FIX: Detect and filter out raw JSON tool calls from text content
                        const isJson = text.trim().startsWith('{') && text.trim().endsWith('}')
                        const hasAction = text.includes('"action"') || text.includes('"tool"') || text.includes('"tool_calls"')

                        if (text.length > 0 && !(isJson && hasAction)) {
                            // Only yield if this is NEW content (crude check for incremental streams)
                            yield { type: 'content', content: text }
                            fullContent = text // In deepagents, sometimes we get the full accumulated text
                        }

                        // Handle Tool Calls
                        if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
                            pendingToolCalls = lastMsg.tool_calls
                            yield { type: 'tool_calls', toolCalls: lastMsg.tool_calls }
                        }
                    }
                }

                // Handle Reasoning / Thoughts
                // DeepAgents might use 'planner' or 'thought' keys
                if (chunk.planner?.plan) {
                    yield { type: 'plan_update', plan: chunk.planner.plan }
                }

                // Subagent / Reasoning log
                if (namespace.length > 0) {
                    const subagentName = namespace.join(':')
                    // If we found messages in a subagent, treat it as reasoning
                    if (newMessages.length > 0) {
                        const lastMsg = newMessages[newMessages.length - 1]
                        const text = typeof lastMsg.content === 'string' ? lastMsg.content : ''
                        if (text) {
                            yield {
                                type: 'reasoning',
                                content: `[${subagentName}] ${text}`,
                                phase: 'executor'
                            }
                        }
                    }
                }
            }

            console.log(`[DeepAgentProvider] Stream finished. Total chunks: ${chunkCount}`)

            yield {
                type: 'done',
                fullContent,
                hasMoreSteps: pendingToolCalls.length > 0
            }
        } catch (error: any) {
            console.error('[DeepAgentProvider] Streaming error:', error)
            yield { type: 'error', error: error.message }
        }
    }
}
