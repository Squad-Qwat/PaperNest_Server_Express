import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createAIModel } from "../../config";
import { loadPrompts } from "../../promptLoader";
import { getActiveToolsForState } from "../../tools/workspace.tool";
import { aiRegistry } from "../../providers/registry";
import { extractTokenMetadata, getToolDescriptions } from "../../utils";
import { PlanSchema } from "../schemas/planSchema";
import type { AgentStateType } from "../state";

export const plannerNode = async (state: AgentStateType) => {
	const prompts = await loadPrompts(["system", "planner"]);

	if (!prompts.system || !prompts.planner) {
		console.error("[Planner] Missing required prompts (system or planner)");
		return {
			plan: [
				{
					id: "1",
					description: "ERROR: System prompts not loaded",
					status: "failed" as const,
					confidence: 0,
					acceptanceCriteria: "Prompt loading failed",
				},
			],
			goal: state.goal,
		};
	}

	if (state.plan && state.plan.length > 0 && !state.needsReplanning) {
		return { goal: state.goal };
	}

	const model = createAIModel({
		provider: state.providerId as any,
		model: state.modelId,
		reasoningEnabled: state.reasoningEnabled,
		streaming: false,
	});

	const taskMessage = state.goal?.trim()
		? state.goal
		: state.messages.at(-1)?.content &&
				typeof state.messages.at(-1)?.content === "string"
			? (state.messages.at(-1)?.content as string).trim()
			: "";

	if (!taskMessage) {
		console.warn("[Planner] No task message provided, cannot create plan");
		return {
			plan: [
				{
					id: "1",
					description: "No task provided",
					status: "failed" as const,
					confidence: 0,
					acceptanceCriteria: "Task required to create plan",
				},
			],
		};
	}

	const hasActiveDocument = state.documentId && state.documentId !== "unknown" && state.documentId !== "";
	const documentSnippet = hasActiveDocument
		? `[Active File: ${state.activeFileName || "main.tex"}]\n` + (state.documentContent?.slice(0, 2000) || "(no document content)")
		: "(no active document - user is on the workspace dashboard, not inside the document editor)";
	const tools = getActiveToolsForState(state);
	let toolDescriptions = getToolDescriptions(tools);

	const provider = aiRegistry.getProvider(state.providerId as any);
	const searchTools = (state.webSearchEnabled && provider && typeof provider.getNativeSearchTools === "function")
		? provider.getNativeSearchTools()
		: [];

	if (searchTools.length > 0) {
		const searchToolDescriptions: string[] = [];
		for (const tool of searchTools) {
			if (tool && typeof tool === "object") {
				if ("google_search" in tool) {
					searchToolDescriptions.push("- **google_search**: Use Google Search to query the live internet for recent news, current events, or real-time web search information.");
				} else if ("name" in tool && "description" in tool) {
					searchToolDescriptions.push(`- **${tool.name}**: ${tool.description}`);
				} else {
					const keys = Object.keys(tool);
					const toolName = keys[0] || "web_search";
					searchToolDescriptions.push(`- **${toolName}**: Query the live internet/web for search results and current events.`);
				}
			}
		}
		if (searchToolDescriptions.length > 0) {
			toolDescriptions += "\n" + searchToolDescriptions.join("\n");
		}
	}

	const plannerPrompt = prompts.planner
		.replace("{tool_descriptions}", toolDescriptions)
		.replace("{document_snippet}", documentSnippet)
		.replace("{task}", taskMessage);

	if (!plannerPrompt.trim()) {
		console.error("[Planner] Planner prompt is empty after substitution");
		return {
			plan: [
				{
					id: "1",
					description: taskMessage,
					status: "pending" as const,
					confidence: 0.5,
					acceptanceCriteria: "Prompt substitution failed, using fallback",
				},
			],
		};
	}

	const sysMsg = new SystemMessage(`${prompts.system}\n\n${plannerPrompt}`);

	try {
		const modelWithStructure = (model as any).withStructuredOutput(PlanSchema, {
			name: "plan",
			includeRaw: true,
		});

		console.log("[Planner] Invoking structured output with:", {
			messageCount: 2,
			taskMessage: taskMessage.substring(0, 50),
		});

		const lastUserMsg = [...state.messages]
			.reverse()
			.find((m) => m instanceof HumanMessage);

		const plannerInputMessage =
			lastUserMsg && Array.isArray(lastUserMsg.content)
				? new HumanMessage({
						content: [
							{ type: "text", text: `Plan this task: ${taskMessage}` },
							...lastUserMsg.content.filter(
								(part: any) => part.type !== "text",
							),
						],
					})
				: new HumanMessage(`Plan this task: ${taskMessage}`);

		const response = await modelWithStructure.invoke([
			sysMsg,
			plannerInputMessage,
		]);

		const parsedPlan = response.parsed;
		const rawMsg = response.raw;

		if (!parsedPlan?.steps) {
			console.error(
				"[Planner] Structured output returned success but parsedPlan or steps is null/undefined. Falling back.",
			);
			throw new Error("Incomplete structured output from model");
		}

		const usage = (rawMsg as any).response_metadata?.token_usage || {};
		const tokens = extractTokenMetadata(usage);

		console.log("[Planner] Structured output succeeded:", {
			stepsCount: parsedPlan.steps.length,
			firstStepTool: parsedPlan.steps[0]?.tool,
		});

		const plan = parsedPlan.steps.map((step: any, idx: number) => ({
			...step,
			id: step.id || String(idx + 1),
			status: "pending" as const,
			confidence: step.confidence ?? 0.9,
		}));

		const plannerReasoning =
			typeof parsedPlan.reasoning === "string" &&
			parsedPlan.reasoning.trim().length > 0
				? `### Planner\n${parsedPlan.reasoning.trim()}`
				: `### Planner\nGenerated ${plan.length} step(s) to accomplish the task.`;

		return {
			plan,
			needsReplanning: false,
			consecutiveNoExecutionCycles: 0,
			goal: taskMessage,
			lastReasoningSummary: plannerReasoning,
			lastReasoningPhase: plannerReasoning ? "planner" : "",
			inputTokens: tokens.inputTokens,
			outputTokens: tokens.outputTokens,
			reasoningTokens: tokens.reasoningTokens,
		};
	} catch (err) {
		console.error(
			"[Planner] Structured output failed, using fallback plan:",
			err instanceof Error ? err.message : String(err),
		);
		const fallbackPlan = [
			{
				id: "1",
				description: taskMessage,
				status: "pending" as const,
				confidence: 0.7,
				acceptanceCriteria: "Task executed without error",
				tool: undefined,
			},
		];
		console.warn("[Planner] Fallback plan created (no tool field!):", {
			steps: fallbackPlan.map((s) => ({
				id: s.id,
				tool: s.tool,
				status: s.status,
			})),
		});
		return {
			plan: fallbackPlan,
			needsReplanning: false,
			consecutiveNoExecutionCycles: 0,
			goal: taskMessage,
			lastReasoningSummary:
				"### Planner\nStructured plan generation failed, using a safe single-step fallback plan.",
			lastReasoningPhase: "planner",
		};
	}
};
