import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { loadPrompts } from '../../promptLoader'
import { createAIModel } from '../../config'
import { AgentStateType } from '../state'
import { contentToText, extractTokenMetadata } from '../../utils'



/**
 * Reflector Node (LLM-Driven)
 *
 * Evaluates the result of the last tool execution against the step's acceptance
 * criteria and returns a COMPLETE / CONTINUE / REPLAN verdict from the LLM.
 */
export const reflectorNode = async (state: AgentStateType) => {
    const prompts = await loadPrompts(['system', 'reflector'])

    // Validate prompts loaded
    if (!prompts.system || !prompts.reflector) {
        console.error('[Reflector] Missing required prompts')
        return {
            isComplete: true, // Fail-safe: mark complete to avoid infinite loop
        }
    }

    const model = createAIModel({
        provider: state.providerId as any,
        model: state.modelId,
        reasoningEnabled: state.reasoningEnabled,
    })

    // Find the active step
    const plan = [...state.plan]
    const activeIndex = plan.findIndex(
        (s) => s.status === 'active' || s.status === 'pending'
    )
    const activeStep = activeIndex !== -1 ? plan[activeIndex] : null

    // CRITICAL: If no active/pending step found, should not happen
    // (Executor/Router should have prevented this, but safety check anyway)
    if (activeIndex < 0 || !activeStep) {
        console.warn('[Reflector] No active/pending step found! Reflector should not be called.')
        console.warn('[Reflector] Plan state:', {
            totalSteps: state.plan.length,
            allSteps: state.plan.map(s => ({
                id: s.id,
                status: s.status,
            })),
        })
        return {
            plan,
            isComplete: true,
            confidence: 0,
            lastReasoningSummary: '### Reflector\nNo active step found, ending execution safely.',
            lastReasoningPhase: 'reflector',
        }
    }

    // Validate active step has valid description
    if (!activeStep?.description || typeof activeStep.description !== 'string' || !activeStep.description.trim()) {
        console.warn('[Reflector] Active step has invalid description, marking as failed')
        if (activeIndex >= 0) {
            plan[activeIndex] = { ...plan[activeIndex], status: 'failed' }
        }
        return {
            plan,
            isComplete: true, // Fail-safe exit
            confidence: 0,
            lastReasoningSummary: `### Reflector\nStep ${activeStep?.id || '?'} is invalid (missing description), marked as failed.`,
            lastReasoningPhase: 'reflector',
        }
    }

    // Get tool result for the active step: match by tool_call_id if available
    let resultText = 'No tool result available'

    console.log(`[Reflector] Active step: ${activeStep?.id} (tool: ${activeStep?.tool}, status: ${activeStep?.status})`)
    console.log('[Reflector] Full plan state:', {
        activeIndex,
        planLength: state.plan.length,
        steps: state.plan.map(s => ({
            id: s.id,
            description: s.description?.substring(0, 30),
            tool: s.tool,
            status: s.status,
        })),
    })
    console.log('[Reflector] lastToolResults available:', {
        count: state.lastToolResults?.length ?? 0,
        results: state.lastToolResults?.map(r => ({ name: r.name, hasResult: !!r.result })),
    })

    // Try to find result matching this step's expected tool
    if (state.lastToolResults && state.lastToolResults.length > 0) {
        const stepTool = activeStep?.tool
        const resultForStep = stepTool
            ? state.lastToolResults.find(r => r.name === stepTool)
            : state.lastToolResults.at(-1)

        if (resultForStep?.result) {
            resultText = resultForStep.result
            console.log(`[Reflector] Found result for tool '${resultForStep.name}'`)
        }
    }

    // FALLBACK: If no tool result, check last ToolMessage in message history
    if (resultText === 'No tool result available') {
        const lastToolMessage = [...(state.messages || [])]
            .reverse()
            .find(m => m._getType?.() === 'tool')

        if (lastToolMessage && typeof lastToolMessage.content === 'string') {
            resultText = lastToolMessage.content
            console.log('[Reflector] Using last ToolMessage as fallback')
        }
    }

    console.log(`[Reflector] Evaluating step with result: ${resultText.substring(0, 100)}...`)

    const remainingSteps = plan
        .filter((s) => s.status === 'pending' || s.status === 'active')
        .map((s) => `- ${s.description}`)
        .join('\n') || '(none — this may be the last step)'

    // Build the reflector prompt with all placeholders filled
    const reflectorPrompt = prompts.reflector
        .replace('{step_description}', activeStep.description)
        .replace('{acceptance_criteria}', activeStep.acceptanceCriteria || 'Step executed without error')
        .replace('{result}', resultText)
        .replace('{remaining_steps}', remainingSteps)

    const sysMsg = new SystemMessage(prompts.system + '\n\n' + reflectorPrompt)

    let pastSteps = [...(state.pastSteps || [])]
    let needsReplanning = false
    let confidence = state.confidence ?? 1
    let replanAttempts = state.replanAttempts ?? 0
    let consecutiveNoExecutionCycles = state.consecutiveNoExecutionCycles ?? 0

    const lastExecutionOutcome = state.lastExecutionOutcome ?? 'no_execution'
    const hasToolResult = resultText !== 'No tool result available'
    const lastAiMessage = [...(state.messages || [])]
        .reverse()
        .find((m) => m.getType?.() === 'ai')
    const aiText = lastAiMessage
        ? contentToText(lastAiMessage.content).trim()
        : ''
    const hasMeaningfulText = aiText.length > 0

    const noExecutionDetected =
        lastExecutionOutcome === 'no_execution' &&
        !hasToolResult &&
        !hasMeaningfulText

    if (noExecutionDetected) {
        console.warn(`[Reflector] No execution detected for step ${activeStep?.id}, soft-completing step to avoid loop`)
        // If it's just a greeting or text response, mark as completed
        if (activeIndex !== -1) {
            plan[activeIndex] = { ...plan[activeIndex], status: 'completed' as const }
            pastSteps.push([plan[activeIndex].id, plan[activeIndex].description])
        }

        consecutiveNoExecutionCycles += 1
        const shouldLightReplan = consecutiveNoExecutionCycles >= 2 && !hasMeaningfulText

        if (shouldLightReplan) {
            needsReplanning = true
            replanAttempts += 1
        }

        return {
            plan,
            pastSteps,
            needsReplanning: true, // Force a replan if no execution was detected
            confidence: hasMeaningfulText ? 0.9 : 0.2,
            replanAttempts: (state.replanAttempts ?? 0) + 1,
            consecutiveNoExecutionCycles: consecutiveNoExecutionCycles + 1,
            isComplete: false,
            lastReasoningSummary: hasMeaningfulText
                ? `### Reflector\nAI provided a text response but no document change was executed. Triggering replan to ensure the goal is met.`
                : `### Reflector\nNo execution detected for step ${activeStep?.id}. Triggering replan to avoid infinite loop.`,
            lastReasoningPhase: 'reflector',
        }
    }

    // Logic for judging text-only outcome even if a tool was planned
    const executorPromptAddon = lastExecutionOutcome === 'executed_text_only'
        ? "\n\nNOTE: The AI provided a text-only response instead of using the planned tool. If the text response is a valid greeting or correctly answers the user's intent without needing the tool, mark it as COMPLETE or CONTINUE."
        : ""

    let reflectorReasoning = ''

    let responseMetadata: any = {}

    // Define isComplete here as it's modified in the try block
    let isComplete = false;

    try {
        const response = await model.invoke([
            sysMsg,
            // Gemini requires at least one user turn in 'contents' — SystemMessage alone causes 400
            new HumanMessage(`Evaluate the step execution above and provide your COMPLETE/CONTINUE/REPLAN verdict.${executorPromptAddon}`),
        ])
        responseMetadata = (response as any).response_metadata || {}
        const verdict = contentToText(response.content).toUpperCase()

        console.log(`[Reflector] Verdict for step "${activeStep?.description}": ${verdict.slice(0, 80)}`)

        if (verdict.startsWith('REPLAN')) {
            // Step failed, need replan
            needsReplanning = true
            confidence = 0.2
            replanAttempts += 1
            consecutiveNoExecutionCycles = 0
            console.log(`[Reflector] Step ${activeStep?.id}: active → REPLAN NEEDED`)
            reflectorReasoning = `**Step ${activeStep.id} Verdict:** REPLAN (Retry needed)`
        } else if (verdict.startsWith('COMPLETE')) {
            // Task fully accomplished
            // We trust the LLM's COMPLETE verdict as the ultimate authority, 
            // relying on updated System/Reflector prompts for accuracy.
            for (let i = 0; i < plan.length; i++) {
                if (plan[i].status !== 'failed') {
                    plan[i] = { ...plan[i], status: 'completed' as const }
                }
            }
            needsReplanning = false
            confidence = 1.0
            consecutiveNoExecutionCycles = 0
            isComplete = true
            reflectorReasoning = `**Step ${activeStep.id} Verdict:** COMPLETE (Goal achieved)`
        } else {
            // Step succeeded (CONTINUE)
            if (activeIndex !== -1) {
                // ONE-WAY STATE MACHINE: Only active → completed transition
                if (plan[activeIndex].status === 'active') {
                    plan[activeIndex] = { ...plan[activeIndex], status: 'completed' as const }
                    console.log(`[Reflector] Step ${activeStep?.id}: active → completed`)
                } else {
                    console.warn(`[Reflector] Step ${activeStep?.id}: already ${plan[activeIndex].status}, not transitioning`)
                }
                pastSteps.push([plan[activeIndex].id, plan[activeIndex].description])
            }
            needsReplanning = false
            confidence = 0.9
            consecutiveNoExecutionCycles = 0
            reflectorReasoning = `**Step ${activeStep.id} Verdict:** CONTINUE (Proceeding)`
        }
    } catch (err) {
        // LLM error: mark step as failed to break infinite loop
        // Do NOT mark as completed (failed is more honest)
        console.error('[Reflector] LLM evaluation failed:', err instanceof Error ? err.message : String(err))
        if (activeIndex !== -1 && plan[activeIndex].status === 'active') {
            plan[activeIndex] = { ...plan[activeIndex], status: 'failed' as const }
            console.log(`[Reflector] Step ${activeStep?.id}: active → failed (due to LLM error)`)
        }
        needsReplanning = true
        confidence = 0.2
        replanAttempts += 1
        consecutiveNoExecutionCycles = 0
        reflectorReasoning = `### Reflector\nEvaluation failed due to model error, requesting replan.`
    }


    const usage = responseMetadata.token_usage || {}
    const tokens = extractTokenMetadata(usage)

    const remainingFinal = plan.filter(
        (s) => s.status === 'pending' || s.status === 'active'
    )

    return {
        plan,
        pastSteps,
        needsReplanning,
        confidence,
        replanAttempts,
        consecutiveNoExecutionCycles,
        isComplete: !needsReplanning && (isComplete || remainingFinal.length === 0),
        lastReasoningSummary: reflectorReasoning,
        lastReasoningPhase: reflectorReasoning ? 'reflector' : '',
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        reasoningTokens: tokens.reasoningTokens,
    }
}
