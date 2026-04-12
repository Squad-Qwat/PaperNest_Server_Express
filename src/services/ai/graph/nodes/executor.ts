import { loadPrompts } from '../../promptLoader'
import { createAIModel } from '../../config'
import { createCodeMirrorTools } from '../../tools/schemas'
import { semanticScholarTool } from '../../tools/semanticScholar.tool'
import { AgentStateType } from '../state'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { contentToText, extractTokenMetadata, getToolDescriptions } from '../../utils'



/**
 * Executor Node
 * Executes a single step of the plan using the LLM with tool bindings.
 */
export const executorNode = async (state: AgentStateType) => {
    const prompts = await loadPrompts(['system', 'executor'])

    // Validate prompts loaded
    if (!prompts.system || !prompts.executor) {
        console.error('[Executor] Missing required prompts')
        return {
            messages: [],
        }
    }

    const model = createAIModel({
        provider: state.providerId as any,
        model: state.modelId,
        reasoningEnabled: state.reasoningEnabled,
    })
    const tools = [...createCodeMirrorTools(), semanticScholarTool]
    const modelWithTools = (model as any).bindTools(tools)

    // Priority: 'active' step first (FE tool results returned for this step in round 2),
    // then 'pending' (fresh step, round 1).
    const currentStep =
        state.plan.find((s) => s.status === 'active') ??
        state.plan.find((s) => s.status === 'pending')

    // DEBUG: Log step details
    console.log('[Executor] Current step lookup:', {
        stepId: currentStep?.id,
        stepDescription: currentStep?.description?.substring(0, 50),
        stepTool: currentStep?.tool,
        stepStatus: currentStep?.status,
        allPlanSteps: state.plan.map(s => ({
            id: s.id,
            tool: s.tool,
            status: s.status,
        })),
    })

    // CRITICAL: If no pending/active step found, should not happen
    // (Router should have routed to END, but safety check anyway)
    if (!currentStep || currentStep.status === 'completed') {
        console.log(`[Executor] No pending/active step found or step already completed. Ending execution for this node.`)
        return {
            messages: [],
        }
    }

    // Validate current step exists and has valid description
    if (!currentStep?.description || typeof currentStep.description !== 'string' || !currentStep.description.trim()) {
        console.warn('[Executor] Current step invalid or missing description:', currentStep)
        
        // CRITICAL FIX: Mark step as failed to break infinite loop
        // If step is active/pending but has no description, it's a data integrity issue
        const failedPlan = state.plan.map(s => {
            if (s.id === currentStep?.id) {
                console.warn(`[Executor] Marking step ${s.id} as FAILED due to missing description`)
                return { ...s, status: 'failed' as const }
            }
            return s
        })
        
        return {
            messages: [],
            plan: failedPlan,  // Update plan to break loop
        }
    }

    const planText = state.plan
        .map((s) => {
            const marker =
                s.status === 'active' ? '/' : s.status === 'completed' ? 'x' : ' '
            return `- [${marker}] ${s.description}`
        })
        .join('\n')

    const toolDescriptions = getToolDescriptions()

    // Fill all executor prompt placeholders
    const executorPrompt = prompts.executor
        .replace('{tool_descriptions}', toolDescriptions)
        .replace('{current_step}', currentStep.description.trim())
        .replace('{full_plan}', planText)

    const contextContent = `\n[CURRENT DOCUMENT STATE]\n${state.documentContent || '(empty)'}\n`
    const sysMsg = new SystemMessage(prompts.system + '\n\n' + executorPrompt + '\n\n' + contextContent)

    const fullInput = [sysMsg, ...state.messages]

    console.log('[Executor] Invoking model for step', currentStep?.id, ':', {
        stepDescription: currentStep?.description?.substring(0, 50),
        stepTool: currentStep?.tool,
        inputMessageCount: fullInput.length,
        hasTools: tools.length > 0,
        toolNames: tools.map(t => t.name),
        stateMessagesCount: state.messages.length,
        lastMessageType: state.messages.at(-1)?._getType?.() ?? 'unknown',
    })

    let response
    try {
        response = await modelWithTools.invoke(fullInput)
    } catch (error) {
        console.error('[Executor] invoke failed with full history, retrying with minimal context:', {
            messageCount: state.messages.length,
            error: error instanceof Error ? error.message : String(error),
        })

        const lastUserText = [...state.messages]
            .reverse()
            .map((message: any) => {
                const type = typeof message?._getType === 'function' ? message._getType() : ''
                return type === 'human' ? contentToText(message.content).trim() : ''
            })
            .find((text) => text.length > 0)

        const fallbackHuman = new HumanMessage(
            lastUserText || currentStep?.description || state.goal || 'Continue with the current plan.'
        )

        response = await modelWithTools.invoke([sysMsg, fallbackHuman])
    }

    // DEBUG: Log response details
    const toolCalls = (response as any).tool_calls ?? []
    const contentPreviewText = typeof response.content === 'string' ? response.content.substring(0, 80) : 
           Array.isArray(response.content) ? `[Array of ${response.content.length}]` : 'non-string'
    console.log('[Executor] Response received for step', currentStep?.id, ':', {
        responseType: response._getType?.() ?? 'unknown',
        hasToolCalls: toolCalls.length > 0,
        toolCallsCount: toolCalls.length,
        toolNames: toolCalls.map((tc: any) => tc.name),
        contentLength: typeof response.content === 'string' ? response.content.length : 'unknown',
        contentPreview: contentPreviewText,
    })

    const responseText = contentToText(response.content).trim()
    const hasToolCalls = toolCalls.length > 0
    const lastExecutionOutcome = hasToolCalls
        ? 'executed_tool'
        : (responseText.length > 0 ? 'executed_text_only' : 'no_execution')
    const lastExecutionEvidence = hasToolCalls
        ? `tool_calls:${toolCalls.map((tc: any) => tc.name).join(',')}`
        : (responseText.slice(0, 500) || 'No model output generated')

    const executorReasoning = (() => {
        if (hasToolCalls) {
            return `**Step ${currentStep.id}:** Executing tool(s) [${toolCalls.map((tc: any) => tc.name).join(', ')}]`
        }
        if (responseText.length > 0) {
            return `**Step ${currentStep.id}:** Generated direct response.`
        }
        return `**Step ${currentStep.id}:** No output (Reflecting...)`
    })()

    // Mark the current step as 'active' in the plan update
    // ONE-WAY STATE MACHINE: Only 'pending' → 'active' transition allowed
    // This prevents status "bounce-back" (active → pending, completed → pending, etc)
    const updatedPlan = state.plan.map((s) => {
        if (s.id === currentStep?.id) {
            // Only pending steps can transition to active
            if (s.status === 'pending') {
                console.log(`[Executor] Step ${s.id}: pending → active`)
                return { ...s, status: 'active' as const }
            } else if (s.status === 'active') {
                // Already active, continue execution
                console.log(`[Executor] Step ${s.id}: Already active, continuing`)
                return s
            } else {
                // ERROR: Trying to execute completed/failed step - should not happen
                console.error(`[Executor] Step ${s.id}: Already ${s.status}, cannot execute! Marking failed.`)
                return { ...s, status: 'failed' as const }
            }
        }
        return s
    })

    console.log('[Executor] Plan after transition:', {
        steps: updatedPlan.map(s => ({
            id: s.id,
            status: s.status,
        })),
    })

    const usage = (response as any).response_metadata?.token_usage || {}
    const tokens = extractTokenMetadata(usage)
    
    return {
        messages: [response],
        plan: updatedPlan,
        iteration: (state.iteration || 0) + 1,
        lastExecutionOutcome,
        lastExecutionEvidence,
        lastReasoningSummary: executorReasoning,
        lastReasoningPhase: executorReasoning ? 'executor' : '',
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        reasoningTokens: tokens.reasoningTokens,
    }
}
