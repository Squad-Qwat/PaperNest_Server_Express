/**
 * LangGraph Routing Functions - Advanced Architecture
 *
 * Controls flow between Planner, Executor, Tools, and Reflector
 * 
 * ====== ONE-WAY STATE MACHINE (Simple & Powerful) ======
 * 
 * Step Status Transitions (STRICT & IRREVERSIBLE):
 * 
 * 1. pending → active (Executor only)
 *    - Only Executor can start a step
 *    - Only pending steps can transition to active
 *    - Once active, cannot go back to pending
 * 
 * 2. active → completed (Reflector only, on success)
 *    - Reflector evaluates LLM verdict (COMPLETE/CONTINUE)
 *    - If success: active → completed (FINAL)
 *    - Cannot revert: completed steps never reopen
 * 
 * 3. active → failed (Reflector or Executor, on error)
 *    - Reflector: LLM error or detected failure
 *    - Executor: Step validation failed
 *    - If failed: triggers END (don't retry individual steps)
 * 
 * Replan Strategy:
 * - If REPLAN needed: Planner generates FRESH plan
 * - Fresh plan: all steps start as pending (no carry-over from failed plan)
 * - Max 3 replan attempts (then END to prevent infinite loop)
 * 
 * Benefits:
 * - Crystal clear: no status "bounce-back"
 * - No ambiguous multi-state scenarios
 * - Easy to debug: log shows exact transition at each node
 * - Prevents loops: once completed/failed, never re-execute
 */

import { AIMessage } from '@langchain/core/messages'
import { AgentStateType } from './state'

/**
 * Routing destinations
 */
export const ROUTES = {
    PLANNER: 'planner',
    EXECUTOR: 'executor',
    TOOLS: 'tools',
    REFLECTOR: 'reflector',
    END: '__end__',
} as const

export type RouteType = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * routeAfterPlanner: Always go to executor to start first step
 */
export function routeAfterPlanner(state: AgentStateType): RouteType {
    // If no steps generated, end
    if (!state.plan || state.plan.length === 0) {
        return ROUTES.END
    }

    // SHORT-CIRCUIT: If we are resuming with tool results from the frontend,
    // skip the EXECUTOR and go straight to the REFLECTOR for evaluation.
    // This prevents the "Restart Loop" where Step 1 is executed multiple times.
    if (state.lastToolResults && state.lastToolResults.length > 0) {
        console.log('[Router] Resumption detected (tool results present) → Short-circuit to REFLECTOR')
        return ROUTES.REFLECTOR
    }

    return ROUTES.EXECUTOR
}

/**
 * routeAfterExecutor: Check for tool calls
 * 
 * FIXED: Route to TOOLS instead of END to ensure reflector is called
 * Flow: EXECUTOR → TOOLS → REFLECTOR ensures proper step evaluation
 */
export function routeAfterExecutor(state: AgentStateType): RouteType {
    const lastMessage = state.messages.at(-1)

    // Check for tool calls.
    // IMPORTANT: Do NOT use `instanceof AIMessage` here!
    // MemorySaver serializes/deserializes messages as plain objects, losing prototype info.
    // Duck-type check is required for compatibility after checkpointer roundtrip.
    const msgType = typeof (lastMessage as any)?._getType === 'function'
        ? (lastMessage as any)._getType()
        : (lastMessage as any)?.type

    const isAiMessage = msgType === 'ai'
    const toolCalls = isAiMessage ? ((lastMessage as any).tool_calls ?? []) : []

    console.log('[Router] routeAfterExecutor: lastMessage has tool_calls:', {
        messageType: msgType ?? 'unknown',
        toolCallCount: toolCalls.length,
        toolNames: toolCalls.map((tc: any) => tc.name),
    })

    if (toolCalls.length > 0) {
        // ARCHITECTURE NOTE: All tools are client-side stubs (schemas.ts).
        // The schema functions only return JSON action strings, NOT real results.
        // Real execution happens in `executeEditorTool` on the frontend (CodeMirror).
        // Flow: Backend yields tool_calls via SSE → FE executes → FE sends toolResults back.
        // We MUST end the graph here so FE can execute and return results in the next request.
        console.log('[Router] Tool calls detected → pausing for frontend execution (END)')
        return ROUTES.END
    }

    // No tool calls means step completed via LLM text only
    // Proceed to reflection/evaluation
    console.log('[Router] No tool calls, routing to REFLECTOR directly')
    return ROUTES.REFLECTOR
}

/**
 * routeAfterTools: Back to Reflector to check success
 */
export function routeAfterTools(state: AgentStateType): RouteType {
    // In this simple version, 1 tool execution = 1 step attempt
    // Real world might allow multiple tool uses per step
    return ROUTES.REFLECTOR
}

/**
 * routeAfterReflector: Decide next move
 * Priority order:
 * 1. Iteration limit exceeded -> End (safety)
 * 2. Failed status in plan -> End (cannot recover)
 * 3. Low confidence + needs replanning -> Planner (max 3 replans)
 * 4. Task complete -> End
 * 5. More steps in plan -> Executor
 * 6. No more steps -> End
 */
export function routeAfterReflector(state: AgentStateType): RouteType {
    // Safety: Check iteration limit first
    if (state.iteration >= state.maxIterations) {
        console.warn(`[Router] Max iterations (${state.maxIterations}) reached, forcing end`)
        return ROUTES.END
    }

    const replanAttempts = state.replanAttempts ?? 0
    if (replanAttempts >= 3) {
        console.warn('[Router] Max persistent replan attempts (3) reached, ending to prevent infinite loop')
        return ROUTES.END
    }

    const consecutiveNoExecutionCycles = state.consecutiveNoExecutionCycles ?? 0
    if (consecutiveNoExecutionCycles >= 3) {
        console.warn('[Router] Too many consecutive no-execution cycles (3), ending to prevent blind loop')
        return ROUTES.END
    }

    // Check for failed steps (invalid plans that can't be recovered)
    const hasFailedSteps = state.plan.some(s => s.status === 'failed')
    if (hasFailedSteps) {
        console.warn('[Router] Plan contains failed steps, cannot recover, ending')
        return ROUTES.END
    }

    // Low confidence should trigger replanning (but with limit)
    if (state.needsReplanning || (state.confidence < 0.3 && !state.isComplete)) {
        console.log(`[Router] Replanning triggered (confidence: ${state.confidence}, needsReplanning: ${state.needsReplanning}, replanAttempts: ${replanAttempts})`)
        return ROUTES.PLANNER
    }

    // Check if complete
    if (state.isComplete) {
        console.log('[Router] Task complete, ending')
        return ROUTES.END
    }

    // Check if more steps remain in plan (by status, not total length)
    const pendingSteps = state.plan.filter((s) => s.status === 'pending' || s.status === 'active')
    if (pendingSteps.length > 0) {
        console.log(`[Router] ${pendingSteps.length} step(s) remaining (pending/active), continuing execution`)
        console.log('[Router] Remaining steps:', {
            steps: pendingSteps.map(s => ({
                id: s.id,
                tool: s.tool,
                status: s.status,
                description: s.description?.substring(0, 40),
            })),
        })
        return ROUTES.EXECUTOR
    }

    // No more steps in plan = done
    console.log('[Router] No more steps in plan, ending')
    console.log('[Router] Final plan state:', {
        steps: state.plan.map(s => ({
            id: s.id,
            tool: s.tool,
            status: s.status,
        })),
        totalCompleted: state.plan.filter(s => s.status === 'completed').length,
        totalFailed: state.plan.filter(s => s.status === 'failed').length,
    })
    return ROUTES.END
}
