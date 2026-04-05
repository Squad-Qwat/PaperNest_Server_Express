import type { BaseMessage, ToolMessage } from "@langchain/core/messages";
import { ToolNode as BaseToolNode } from "@langchain/langgraph/prebuilt";
import { createRAGTool } from "../../tools/rag.tool";
import { createCodeMirrorTools } from "../../tools/schemas";
import { semanticScholarTool } from "../../tools/semanticScholar.tool";
import type { AgentStateType } from "../state";

export const toolNode = async (state: AgentStateType) => {
	try {
		console.log(
			"[ToolNode] Handoff initiated. Generating client/backend execution payload.",
		);

		// Create a tool node instance that includes backend-executed tools
		const tools = [
			...createCodeMirrorTools(),
			semanticScholarTool,
			createRAGTool(state.documentId || "unknown"),
		];
		const baseToolNode = new BaseToolNode(tools);

		// Execute tool node (this will run Semantic Scholar/RAG on backend,
		// and generate action stubs for CodeMirror tools)
		const result = await baseToolNode.invoke(state);

		console.log(
			"[ToolNode] Tool execution/handoff prepared. returning to Client/Next node.",
		);

		// Extract ToolMessages (stubs) to ensure state.lastToolResults is initialized
		if (result.messages && result.messages.length > 0) {
			const toolMessages = result.messages.filter(
				(msg: BaseMessage): msg is ToolMessage => msg._getType?.() === "tool",
			);

			if (toolMessages.length > 0) {
				const extracted = toolMessages.map((msg: ToolMessage) => ({
					name: msg.name,
					result: msg.content,
					toolCallId: msg.tool_call_id,
				}));

				return {
					...result,
					lastToolResults: extracted,
				};
			}
		}

		return result;
	} catch (err) {
		console.error("[ToolNode] Fatal error during client handoff:", err);
		throw err;
	}
};
