/**
 * Standard AI Agent Types
 * Shared between different agent implementations (Manual Graph & DeepAgent)
 */

export interface ToolResult {
	toolCallId: string;
	name: string;
	result: string;
	success: boolean;
}

export interface StreamEvent {
	type:
		| "content"
		| "tool_calls"
		| "tool_results"
		| "done"
		| "error"
		| "plan_update"
		| "reasoning";
	content?: string;
	toolCalls?: { id: string; name: string; args: Record<string, unknown> }[];
	results?: ToolResult[];
	fullContent?: string;
	hasMoreSteps?: boolean;
	error?: string;
	plan?: any[];
	phase?: "planner" | "executor" | "reflector";
	duration?: number;
}

export interface AgentStreamParams {
	message: string;
	documentContent: string;
	documentHTML: string;
	threadId: string;
	conversationHistory: Array<{ role: string; content: string }>;
	toolResults?: ToolResult[];
	documentId?: string;
	initialPlan?: any[];
	reasoningEnabled?: boolean;
	providerId?: string;
	modelId?: string;
}
