import type { Request, Response } from "express";
import type { ToolResult } from "../types/ai/agent.types";
import { errorResponse } from "../utils/responseFormatter";

export const streamAIResponse = async (
	req: Request,
	res: Response,
): Promise<any> => {
	try {
		const {
			message,
			documentContent = "",
			documentHTML = "",
			conversationHistory = [],
			toolResults,
			documentId,
			workspaceId,
			plan,
			threadId: bodyThreadId,
			reasoningEnabled = false,
			providerId,
			modelId,
			agentId = "manual_graph",
			files = [],
			taggedDocumentIds = [],
		} = req.body;

		const { agentFactory } = await import("../services/ai/agents/agent.factory");
		const { validateAICredentials } = await import("../services/ai/config");

		const credentialsCheck = validateAICredentials(providerId);
		if (!credentialsCheck.valid) {
			return errorResponse(
				res,
				"AI service not configured",
				500,
				credentialsCheck.error ? [credentialsCheck.error] : undefined,
			);
		}

		if (!message || typeof message !== "string") {
			return errorResponse(res, "Message is required", 400);
		}

		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
			"X-Content-Type-Options": "nosniff",
		});

		res.setTimeout(0);

		res.write(
			`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`,
		);

		const threadId = bodyThreadId || Date.now().toString();
		let isDisconnected = false;
		let keepAliveInterval: any;

		try {
			res.on("close", () => {
				isDisconnected = true;
				if (keepAliveInterval) clearInterval(keepAliveInterval);
				console.log(
					`[AI Stream] Client disconnected from response stream (${agentId})`,
				);
			});

			keepAliveInterval = setInterval(() => {
				if (!isDisconnected) {
					res.write(": ping\n\n");
				}
			}, 15000);

			let finalConversationHistory = [...conversationHistory];

			const isToolContinuation = Array.isArray(toolResults) && toolResults.length > 0;
			if (!isToolContinuation && Array.isArray(taggedDocumentIds) && taggedDocumentIds.length > 0) {
				const { default: documentRepository } = await import("../repositories/documentRepository");
				const { default: documentBodyRepository } = await import("../repositories/documentBodyRepository");

				const fetchPromises = taggedDocumentIds.map(async (docId: string) => {
					try {
						const document = await documentRepository.findById(docId);
						if (!document) return null;
						if (workspaceId && document.workspaceId !== workspaceId) return null;
						if (!document.currentVersionId) return null;
						const body = await documentBodyRepository.findById(document.currentVersionId);
						return {
							title: document.title,
							content: body?.content || "",
						};
					} catch (error) {
						console.error(`[AI Controller] Failed to fetch tagged document ${docId}:`, error);
						return null;
					}
				});

				const fetchedDocs = (await Promise.all(fetchPromises)).filter(Boolean);

				if (fetchedDocs.length > 0) {
					const docsBlock = fetchedDocs
						.map((d: any) => `Here is the content of document "${d.title}" for your reference:\n\n${d.content}`)
						.join("\n\n---\n\n");

					finalConversationHistory.unshift(
						{
							role: "user",
							content: `[CONTEXT INJECTION]\n${docsBlock}`,
						},
						{
							role: "assistant",
							content: "Understood. I have loaded the tagged documents into my memory and will use them to answer your questions.",
						}
					);
				}
			}

			const agent = agentFactory.getAgent(agentId);
			console.log(`[AI Controller] Invoking agent: ${agentId}`);

			for await (const chunk of agent.stream({
				message,
				documentContent,
				documentHTML,
				threadId,
				conversationHistory: finalConversationHistory,
				toolResults: toolResults as ToolResult[] | undefined,
				documentId,
				workspaceId,
				initialPlan: plan,
				reasoningEnabled,
				providerId,
				modelId,
				files,
			})) {
				if (isDisconnected) break;
				res.write(`data: ${JSON.stringify(chunk)}\n\n`);

				if (typeof (res as any).flush === "function") {
					(res as any).flush();
				}
				await new Promise((resolve) => setTimeout(resolve, 5));
			}

			if (!isDisconnected) {
				res.write(
					`data: ${JSON.stringify({ type: "stream_end", timestamp: Date.now() })}\n\n`,
				);
			}
		} finally {
			if (keepAliveInterval) clearInterval(keepAliveInterval);
			if (!res.writableEnded) res.end();
		}
	} catch (error) {
		console.error("[AI Stream] Fatal error:", error);
		if (!res.headersSent) {
			errorResponse(
				res,
				"Failed to initialize streaming",
				500,
				error instanceof Error ? [error.message] : undefined,
			);
		} else if (!res.writableEnded && res.writable) {
			try {
				res.write(
					`data: ${JSON.stringify({
						type: "error",
						error: error instanceof Error ? error.message : "Unknown error",
					})}\n\n`,
				);
				res.end();
			} catch (writeError) {
				console.error(
					"[AI Stream] Failed to write error to response:",
					writeError,
				);
			}
		}
	}
};
