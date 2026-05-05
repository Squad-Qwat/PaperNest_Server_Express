/**
 * LangGraph Agent State Definitions
 *
 * Defines the state schema for the document editing agent using LangGraph annotations.
 * This state is passed between nodes and persisted via checkpointer.
 */

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { ToolResult } from "../types/agent.types";

export type ExecutionOutcome =
	| "executed_tool"
	| "executed_text_only"
	| "no_execution"
	| "execution_error";

/**
 * Plan step definition for Plan-and-Execute
 */
export interface PlanStep {
	id: string;
	description: string;
	status: "pending" | "active" | "completed" | "failed";
	tool?: string;
	args?: any;
	result?: string;
	// Smart Planning Fields
	confidence?: number;
	acceptanceCriteria?: string; // How to verify this step succeeded (used by reflector)
	dependencies?: number[];
	suggestedTools?: string[];
}

/**
 * Agent State Annotation
 *
 * Uses LangGraph's Annotation system for proper state management.
 * Each field has a reducer that defines how updates are merged.
 */
export const AgentState = Annotation.Root({
	// ===== MESSAGE HANDLING =====
	messages: Annotation<BaseMessage[]>({
		reducer: messagesStateReducer,
		default: () => [],
	}),

	// ===== DOCUMENT CONTEXT =====
	documentId: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	documentContent: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	documentSections: Annotation<string[]>({
		reducer: (_, newVal) => newVal ?? [],
		default: () => [],
	}),
	documentHTML: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	cursorPosition: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 0,
		default: () => 0,
	}),

	// ===== PLANNING STATE =====
	goal: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	plan: Annotation<PlanStep[]>({
		reducer: (_, newVal) => newVal ?? [],
		default: () => [],
	}),
	currentStepId: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	currentStepDescription: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),

	// ===== META-COGNITION STATE =====
	confidence: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 1,
		default: () => 1,
	}),
	needsReplanning: Annotation<boolean>({
		reducer: (_, newVal) => newVal ?? false,
		default: () => false,
	}),
	reasoningEnabled: Annotation<boolean>({
		reducer: (_, newVal) => newVal ?? false,
		default: () => false,
	}),
	lastReasoningSummary: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	lastReasoningPhase: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),

	// ===== EXECUTION TRACKING =====
	pastSteps: Annotation<Array<[string, string]>>({
		reducer: (_, newVal) => newVal ?? [],
		default: () => [],
	}),

	// ===== LOOP CONTROL =====
	iteration: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 0,
		default: () => 0,
	}),
	maxIterations: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 15,
		default: () => 15, // Increased for multi-step plans
	}),
	recentTools: Annotation<string[]>({
		reducer: (current, newTools) =>
			newTools ? [...current.slice(-10), ...newTools] : current,
		default: () => [],
	}),
	lastToolResults: Annotation<ToolResult[]>({
		reducer: (current, newResults) => {
			if (!newResults) return current;
			// Merge results: keep existing ones, overwrite if name/ID matches, add new ones
			const merged = [...current];
			for (const res of newResults) {
				const idx = merged.findIndex(
					(r) => r.name === res.name || r.toolCallId === res.toolCallId,
				);
				if (idx !== -1) {
					merged[idx] = res;
				} else {
					merged.push(res);
				}
			}
			return merged;
		},
		default: () => [],
	}),
	lastExecutionOutcome: Annotation<ExecutionOutcome>({
		reducer: (_, newVal) => newVal ?? "no_execution",
		default: () => "no_execution",
	}),
	lastExecutionEvidence: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),
	consecutiveNoExecutionCycles: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 0,
		default: () => 0,
	}),
	replanAttempts: Annotation<number>({
		reducer: (_, newVal) => newVal ?? 0,
		default: () => 0,
	}),

	// ===== ERROR HANDLING =====
	lastError: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "",
		default: () => "",
	}),

	// ===== COMPLETION =====
	isComplete: Annotation<boolean>({
		reducer: (_, newVal) => newVal ?? false,
		default: () => false,
	}),

	// ===== TOKEN TRACKING =====
	inputTokens: Annotation<number>({
		reducer: (current, newVal) =>
			Math.max(current || 0, (current || 0) + (newVal || 0)),
		default: () => 0,
	}),
	outputTokens: Annotation<number>({
		reducer: (current, newVal) =>
			Math.max(current || 0, (current || 0) + (newVal || 0)),
		default: () => 0,
	}),
	reasoningTokens: Annotation<number>({
		reducer: (current, newVal) =>
			Math.max(current || 0, (current || 0) + (newVal || 0)),
		default: () => 0,
	}),

	// ===== PROVIDER CONFIG =====
	providerId: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "google-genai",
		default: () => "google-genai",
	}),
	modelId: Annotation<string>({
		reducer: (_, newVal) => newVal ?? "gemini-2.5-flash-lite",
		default: () => "gemini-2.5-flash-lite",
	}),
});

/**
 * Type helper for accessing state
 */
export type AgentStateType = typeof AgentState.State;
