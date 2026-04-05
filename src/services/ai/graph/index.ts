/**
 * LangGraph Agent Definition - Advanced Plan-and-Execute

 *
 * Compiles the StateGraph with Planner, Executor, Tool, and Reflector nodes.
 */

import {
	AIMessage,
	type BaseMessage,
	HumanMessage,
	ToolMessage,
} from "@langchain/core/messages";
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import {
	AgentStreamParams,
	type StreamEvent,
	type ToolResult,
} from "../types/agent.types";
import { contentToText, extractTokenMetadata } from "../utils";
import { executorNode, plannerNode, reflectorNode, toolNode } from "./nodes";
import {
	ROUTES,
	routeAfterExecutor,
	routeAfterPlanner,
	routeAfterReflector,
} from "./routing";
import { AgentState, type AgentStateType } from "./state";

const toSafeText = contentToText;

/**
 * Prune old messages to prevent history explosion
 * Keeps most recent N messages + original conversation turn
 * Removes old ToolMessages but preserves AIMessages for context
 */
const pruneMessageHistory = (
	messages: BaseMessage[],
	maxMessages: number = 20,
): BaseMessage[] => {
	if (messages.length <= maxMessages) {
		return messages;
	}

	// Keep: first message (user), last N messages
	const firstMsg = messages[0];
	const recentMessages = messages.slice(-Math.max(5, maxMessages - 2));

	// Remove consecutive ToolMessages to reduce noise
	const pruned: BaseMessage[] = [firstMsg, ...recentMessages];
	const dedupedMessages: BaseMessage[] = [];

	for (const msg of pruned) {
		const prevMsg = dedupedMessages.at(-1);

		// Skip consecutive ToolMessages (keep the latest one)
		if (msg instanceof ToolMessage && prevMsg instanceof ToolMessage) {
			dedupedMessages[dedupedMessages.length - 1] = msg;
		} else {
			dedupedMessages.push(msg);
		}
	}

	console.log(
		`[History] Pruned from ${messages.length} to ${dedupedMessages.length} messages`,
	);
	return dedupedMessages;
};

/**
 * Define the graph architecture
 */
const graphBuilder = new StateGraph(AgentState)
	// Add nodes
	.addNode(ROUTES.PLANNER, plannerNode)
	.addNode(ROUTES.EXECUTOR, executorNode)
	.addNode(ROUTES.TOOLS, toolNode)
	.addNode(ROUTES.REFLECTOR, reflectorNode)

	// Define edges
	.addEdge(START, ROUTES.PLANNER)

	// Planner routing
	.addConditionalEdges(ROUTES.PLANNER, routeAfterPlanner, {
		[ROUTES.EXECUTOR]: ROUTES.EXECUTOR,
		[ROUTES.REFLECTOR]: ROUTES.REFLECTOR, // Required for resumption short-circuit
		[ROUTES.END]: END,
	})

	// Executor routing: Tool execution → Reflector evaluation or Pause for FE
	// FIXED: Now includes ROUTES.END to support client-side tool execution pause.
	.addConditionalEdges(ROUTES.EXECUTOR, routeAfterExecutor, {
		[ROUTES.TOOLS]: ROUTES.TOOLS,
		[ROUTES.REFLECTOR]: ROUTES.REFLECTOR,
		[ROUTES.END]: END,
	})

	// Tools -> Reflector
	.addEdge(ROUTES.TOOLS, ROUTES.REFLECTOR)

	// Reflector routing (Back loop or End)
	.addConditionalEdges(ROUTES.REFLECTOR, routeAfterReflector, {
		[ROUTES.PLANNER]: ROUTES.PLANNER, // Replan
		[ROUTES.EXECUTOR]: ROUTES.EXECUTOR, // Next step
		[ROUTES.END]: END, // Done
	});

// Compile graph
const checkpointer = new MemorySaver();
export const graph = graphBuilder.compile({ checkpointer });

// Type definitions
export type { AgentStateType };

/**
 * Stream the agent execution
 */
export async function* streamAgent(
	userMessage: string,
	documentContent: string,
	documentHTML: string,
	threadId: string,
	conversationHistory: Array<{ role: string; content: string }> = [],
	existingToolResults?: ToolResult[],
	documentId?: string,
	initialPlan?: any[],
	reasoningEnabled: boolean = false,
	providerId?: string,
	modelId?: string,
): AsyncGenerator<StreamEvent> {
	console.log("[Graph] Starting Plan-and-Execute agent for thread:", threadId);

	try {
		const historyMessages = conversationHistory
			.map((msg) => {
				const text = toSafeText(msg?.content).trim();
				return {
					role: msg?.role,
					text,
				};
			})
			.filter((msg) => msg.role === "user" || msg.role === "assistant")
			.filter((msg) => msg.text.length > 0)
			.map((msg) =>
				msg.role === "user"
					? new HumanMessage(msg.text)
					: new AIMessage(msg.text),
			);

		// Prune history to prevent message explosion (cost & context size)
		const prunedHistory = pruneMessageHistory(historyMessages);

		// taskForGoal must always be the USER's message, never the AI's response.
		// Using conversationHistory.at(-1) is wrong because history can end with an AI message.
		const taskForGoal = userMessage;

		// CRITICAL FIX: Don't reuse plan if all steps are already completed
		// (happens when frontend sends plan from previous execution)
		// New message = generate fresh plan
		const shouldUseInitialPlan =
			initialPlan &&
			initialPlan.length > 0 &&
			!initialPlan.every((s: any) => s.status === "completed");

		console.log("[Graph] Plan reuse check:", {
			hasInitialPlan: !!initialPlan,
			initialPlanLength: initialPlan?.length ?? 0,
			allCompleted:
				initialPlan?.every?.((s: any) => s.status === "completed") ?? false,
			shouldUseInitialPlan,
			action: shouldUseInitialPlan
				? "RESUMING existing plan"
				: "GENERATING fresh plan",
		});

		const initialState: Partial<AgentStateType> = {
			messages: [...prunedHistory, new HumanMessage(userMessage)],
			documentContent,
			documentHTML,
			cursorPosition: 0,
			plan: shouldUseInitialPlan ? initialPlan : [], // Empty if already completed
			pastSteps: [], // Initialize pastSteps for tracking
			needsReplanning: false,
			iteration: 0,
			maxIterations: 15,
			documentId: documentId || "",
			isComplete: false, // Explicitly initialize
			goal: taskForGoal, // Preserve task for replan cycles
			reasoningEnabled,
			providerId: providerId || "google-genai",
			modelId: modelId || "gemma-4-31b-it",
		};

		if (existingToolResults && existingToolResults.length > 0) {
			const normalizedToolResults = existingToolResults.map((r, index) => ({
				...r,
				toolCallId: r?.toolCallId || `tool_${index + 1}`,
				name: r?.name || "unknown_tool",
				result: toSafeText(r?.result),
				success: typeof r?.success === "boolean" ? r.success : true,
			}));

			initialState.lastToolResults = normalizedToolResults;

			// Reconstruct the AIMessage that triggered these tools
			// Add placeholder content to avoid Gemini 400 error on empty messages
			const toolCalls = normalizedToolResults.map((r) => ({
				id: r.toolCallId,
				name: r.name,
				args: {},
			}));

			const toolCallMessage = new AIMessage({
				content: "Executing tool...", // Avoid empty content
				tool_calls: toolCalls,
			});

			const toolResultMessages = normalizedToolResults.map(
				(r) =>
					new ToolMessage({
						content: toSafeText(r.result),
						tool_call_id: r.toolCallId,
						name: r.name,
					}),
			);

			// Append [AIMessage(Call), ToolMessage(Result)] to history
			initialState.messages = [
				...(initialState.messages ?? []),
				toolCallMessage,
				...toolResultMessages,
			];

			// Prune again after adding tool results to prevent explosion
			initialState.messages = pruneMessageHistory(initialState.messages, 25);
		}

		// IMPORTANT: Use a unique threadId per streamAgent invocation.
		// Even though FE sends the same threadIdRef, we append a timestamp so MemorySaver
		// starts fresh each round. State is carried via HTTP payload (plan, toolResults,
		// conversationHistory), NOT via MemorySaver persistence between rounds.
		// This prevents duplicate/accumulated messages in stored state.
		const uniqueThreadId = `${threadId}_${Date.now()}`;
		const config = {
			configurable: { thread_id: uniqueThreadId },
			streamMode: "updates" as const,
		};

		const contentParts: string[] = [];
		let pendingToolCalls: {
			id: string;
			name: string;
			args: Record<string, unknown>;
		}[] = [];
		const reasoningStartTime = Date.now();

		for await (const update of await graph.stream(initialState, config)) {
			const entries = Object.entries(update);

			for (const [nodeName, nodeOutput] of entries) {
				const output = nodeOutput as Partial<AgentStateType>;

				// Stream Plan Updates
				if (
					(nodeName === ROUTES.PLANNER ||
						nodeName === ROUTES.REFLECTOR ||
						nodeName === ROUTES.EXECUTOR) &&
					output.plan
				) {
					yield { type: "plan_update", plan: output.plan };
					console.log(`[Graph] Plan update: ${output.plan.length} steps`);
					if (output.confidence !== undefined) {
						console.log(`[Graph] Confidence Score: ${output.confidence}`);
					}
				}

				if (output.lastReasoningSummary && output.lastReasoningSummary.trim()) {
					const phase = (output.lastReasoningPhase || nodeName) as
						| "planner"
						| "executor"
						| "reflector";
					yield {
						type: "reasoning",
						phase,
						content: output.lastReasoningSummary,
						duration: Math.max(
							1,
							Math.ceil((Date.now() - reasoningStartTime) / 1000),
						),
					};
				}

				// Handle Executor Output (LLM Content)
				// IMPORTANT: With streamMode:'updates' + messagesStateReducer, output.messages is the
				// FULL updated messages array (all messages appended). Use at(-1) but verify it's an AI msg.
				if (nodeName === ROUTES.EXECUTOR && output.messages) {
					// Find the last AI message specifically (not ToolMessage or HumanMessage)
					const newAiMsg = [...output.messages]
						.reverse()
						.find(
							(m: any) =>
								(typeof m._getType === "function" ? m._getType() : m.type) ===
								"ai",
						);
					if (newAiMsg) {
						let textContent = "";
						if (typeof newAiMsg.content === "string") {
							textContent = newAiMsg.content;
						} else if (Array.isArray(newAiMsg.content)) {
							textContent = (newAiMsg.content as any[])
								.filter((part: any) => part.type === "text")
								.map((part: any) => part.text)
								.join("");
						}

						if (textContent && textContent.trim()) {
							// CONSISTENCY FIX: Detect and filter out raw JSON tool calls from text content
							const isJson =
								textContent.trim().startsWith("{") &&
								textContent.trim().endsWith("}");
							const hasAction =
								textContent.includes('"action"') ||
								textContent.includes('"tool"') ||
								textContent.includes('"tool_calls"');

							if (!(isJson && hasAction)) {
								contentParts.push(textContent);
								yield { type: "content", content: textContent };
							}
						}

						const aiToolCalls = (newAiMsg as any).tool_calls ?? [];
						if (aiToolCalls.length > 0) {
							pendingToolCalls = aiToolCalls.map((tc: any) => ({
								id: tc.id ?? `${tc.name}_${Date.now()}`,
								name: tc.name,
								args: tc.args as Record<string, unknown>,
							}));
							yield { type: "tool_calls", toolCalls: pendingToolCalls };
						}
					}
				}

				if (nodeName === ROUTES.TOOLS && output.lastToolResults) {
					yield { type: "tool_results", results: output.lastToolResults };
				}
			}
		}

		// Final state check for token logging
		const finalState = await graph.getState(config);
		const stateValues = finalState.values as AgentStateType;
		const {
			inputTokens = 0,
			outputTokens = 0,
			reasoningTokens = 0,
		} = stateValues;

		// Cost calculation (Gemini 2.5 Flash pricing as of screenshot)
		// Input: $0.15 / 1M tokens
		// Output (incl. thinking): $1.25 / 1M tokens
		// Exchange rate: ~$1 = Rp 16.000
		const inputCostUsd = (inputTokens / 1_000_000) * 0.15;
		const outputCostUsd = (outputTokens / 1_000_000) * 1.25; // Standard pricing usually higher, but using screenshot $1.25
		const totalCostIdr = (inputCostUsd + outputCostUsd) * 16000;

		console.log(`\n\x1b[32m[AI Stats] --------------------------------\x1b[0m`);
		console.log(
			`\x1b[32m[AI Stats] Input Tokens     : ${inputTokens.toLocaleString()}\x1b[0m`,
		);
		console.log(
			`\x1b[32m[AI Stats] Output Tokens    : ${outputTokens.toLocaleString()}\x1b[0m`,
		);
		console.log(
			`\x1b[32m[AI Stats] Thinking Tokens  : ${reasoningTokens.toLocaleString()}\x1b[0m`,
		);
		console.log(
			`\x1b[32m[AI Stats] Est. Cost (IDR)  : Rp ${totalCostIdr.toFixed(2)}\x1b[0m`,
		);
		console.log(`\x1b[32m[AI Stats] --------------------------------\n\x1b[0m`);

		// hasMoreSteps: true if Executor called tools that FE needs to execute.
		// FE loop (while shouldContinue) will send another request with toolResults.
		// This is the correct client-side tool execution pattern.
		yield {
			type: "done",
			fullContent: contentParts.join(""),
			hasMoreSteps: pendingToolCalls.length > 0,
		};
	} catch (error) {
		console.error("[Graph] Error:", error);
		yield {
			type: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
