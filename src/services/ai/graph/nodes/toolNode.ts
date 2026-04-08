import { ToolNode as BaseToolNode } from '@langchain/langgraph/prebuilt'
import { createCodeMirrorTools } from '../../tools/schemas'
import { AgentStateType } from '../state'
import { ToolMessage, BaseMessage } from '@langchain/core/messages'

const baseToolNode = new BaseToolNode(createCodeMirrorTools())

/**
 * ToolNode (Handover Node)
 * 
 * ARCHITECTURE NOTE:
 * All business tools (LaTeX compile, document edit) are executed CLIENT-SIDE 
 * in the user's browser (CodeMirror/React context) for maximum performance 
 * and access to current editor state.
 * 
 * This node primarily acts as a handover point. It is reached when the model
 * generates tool_calls. The Graph then routes to END, returning the call
 * names and arguments to the frontend via SSE.
 */
export const toolNode = async (state: AgentStateType) => {
    try {
        console.log('[ToolNode] Handoff initiated. Generating client-side execution payload.')

        // Execute pre-built tool node to process the AIMessage tool_calls
        const result = await baseToolNode.invoke(state)
        
        console.log('[ToolNode] Handoff prepared. Control returning to Client.')

        // Extract ToolMessages (stubs) to ensure state.lastToolResults is initialized
        if (result.messages && result.messages.length > 0) {
            const toolMessages = result.messages.filter(
                (msg: BaseMessage): msg is ToolMessage => msg._getType?.() === 'tool'
            )

            if (toolMessages.length > 0) {
                const extracted = toolMessages.map((msg: ToolMessage) => ({
                    name: msg.name,
                    result: msg.content,
                    toolCallId: msg.tool_call_id,
                }))

                return {
                    ...result,
                    lastToolResults: extracted,
                }
            }
        }

        return result
    } catch (err) {
        console.error('[ToolNode] Fatal error during client handoff:', err)
        throw err
    }
}
