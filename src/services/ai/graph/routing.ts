import type { AgentStateType } from "./state";

export const ROUTES = {
	PLANNER: "planner",
	EXECUTOR: "executor",
	TOOLS: "tools",
	REFLECTOR: "reflector",
	END: "__end__",
} as const;

export type RouteType = (typeof ROUTES)[keyof typeof ROUTES];

const BACKEND_ONLY_TOOLS = [
	"search_semantic_scholar",
	"search_attached_pdfs",
	"search_workspace_documents",
	"read_workspace_document_by_id",
	"search_workspace_pdfs_rag",
	"search_document_lines_backend",
	"read_document_lines_backend",
];

export function routeAfterPlanner(state: AgentStateType): RouteType {
	if (!state.plan || state.plan.length === 0) {
		return ROUTES.END;
	}

	if (state.lastToolResults && state.lastToolResults.length > 0) {
		console.log(
			"[Router] Resumption detected (tool results present) → Short-circuit to REFLECTOR",
		);
		return ROUTES.REFLECTOR;
	}

	return ROUTES.EXECUTOR;
}

export function routeAfterExecutor(state: AgentStateType): RouteType {
	const lastMessage = state.messages.at(-1);
	const msgType =
		typeof (lastMessage as any)?._getType === "function"
			? (lastMessage as any)._getType()
			: (lastMessage as any)?.type;

	const isAiMessage = msgType === "ai";
	const toolCalls = isAiMessage ? ((lastMessage as any).tool_calls ?? []) : [];

	console.log("[Router] routeAfterExecutor: lastMessage has tool_calls:", {
		messageType: msgType ?? "unknown",
		toolCallCount: toolCalls.length,
		toolNames: toolCalls.map((tc: any) => tc.name),
	});

	if (toolCalls.length > 0) {
		const hasBackendTool = toolCalls.some((tc: any) =>
			BACKEND_ONLY_TOOLS.includes(tc.name),
		);

		if (hasBackendTool) {
			console.log(
				"[Router] Backend tool detected → routing to TOOLS node for server-side execution",
			);
			return ROUTES.TOOLS;
		}

		console.log(
			"[Router] Client-side tool calls detected → pausing for frontend execution (END)",
		);
		return ROUTES.END;
	}

	console.log("[Router] No tool calls, routing to REFLECTOR directly");
	return ROUTES.REFLECTOR;
}

export function routeAfterTools(state: AgentStateType): RouteType {
	return ROUTES.REFLECTOR;
}

export function routeAfterReflector(state: AgentStateType): RouteType {
	if (state.iteration >= state.maxIterations) {
		console.warn(
			`[Router] Max iterations (${state.maxIterations}) reached, forcing end`,
		);
		return ROUTES.END;
	}

	const replanAttempts = state.replanAttempts ?? 0;
	if (replanAttempts >= 3) {
		console.warn(
			"[Router] Max persistent replan attempts (3) reached, ending to prevent infinite loop",
		);
		return ROUTES.END;
	}

	const consecutiveNoExecutionCycles = state.consecutiveNoExecutionCycles ?? 0;
	if (consecutiveNoExecutionCycles >= 3) {
		console.warn(
			"[Router] Too many consecutive no-execution cycles (3), ending to prevent blind loop",
		);
		return ROUTES.END;
	}

	const hasFailedSteps = state.plan.some((s) => s.status === "failed");
	if (hasFailedSteps) {
		console.warn("[Router] Plan contains failed steps, cannot recover, ending");
		return ROUTES.END;
	}

	if (state.needsReplanning || (state.confidence < 0.3 && !state.isComplete)) {
		console.log(
			`[Router] Replanning triggered (confidence: ${state.confidence}, needsReplanning: ${state.needsReplanning}, replanAttempts: ${replanAttempts})`,
		);
		return ROUTES.PLANNER;
	}

	if (state.isComplete) {
		console.log("[Router] Task complete, ending");
		return ROUTES.END;
	}

	const pendingSteps = state.plan.filter(
		(s) => s.status === "pending" || s.status === "active",
	);
	if (pendingSteps.length > 0) {
		console.log(
			`[Router] ${pendingSteps.length} step(s) remaining (pending/active), continuing execution`,
		);
		console.log("[Router] Remaining steps:", {
			steps: pendingSteps.map((s) => ({
				id: s.id,
				tool: s.tool,
				status: s.status,
				description: s.description?.substring(0, 40),
			})),
		});
		return ROUTES.EXECUTOR;
	}

	console.log("[Router] No more steps in plan, ending");
	console.log("[Router] Final plan state:", {
		steps: state.plan.map((s) => ({
			id: s.id,
			tool: s.tool,
			status: s.status,
		})),
		totalCompleted: state.plan.filter((s) => s.status === "completed").length,
		totalFailed: state.plan.filter((s) => s.status === "failed").length,
	});
	return ROUTES.END;
}
