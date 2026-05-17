import { tool } from "@langchain/core/tools";
import { z } from "zod";
import documentRepository from "../../../repositories/documentRepository";
import documentBodyRepository from "../../../repositories/documentBodyRepository";
import { createCodeMirrorTools } from "./schemas";
import { createRAGTool } from "./rag.tool";
import { semanticScholarTool } from "./semanticScholar.tool";

export const searchWorkspaceDocumentsTool = (workspaceId: string) => {
	return tool(
		async ({ query }) => {
			if (!workspaceId || workspaceId === "unknown") {
				return "Workspace context is missing. Cannot search workspace documents.";
			}

			try {
				const documents = await documentRepository.searchByTitle(workspaceId, query);

				if (documents.length === 0) {
					return `No documents matching "${query}" were found in this workspace.`;
				}

				const formatted = documents.map((doc) => {
					return `[Document Title: ${doc.title}] (ID: ${doc.documentId})\nDescription: ${doc.description || "No description"}`;
				}).join("\n\n---\n\n");

				return `Found the following matching documents in the workspace:\n\n${formatted}`;
			} catch (error) {
				console.error("[WorkspaceTool] Search failed:", error);
				return "An error occurred while searching workspace documents.";
			}
		},
		{
			name: "search_workspace_documents",
			description: "Search for documents in the current workspace by their title. Use this when the user references another document by title or asks to search for documents in their workspace.",
			schema: z.object({
				query: z.string().describe("The document title query or keyword to search for"),
			}),
		},
	);
};

export const readWorkspaceDocumentByIdTool = (workspaceId: string) => {
	return tool(
		async ({ documentId }) => {
			if (!workspaceId || workspaceId === "unknown") {
				return "Workspace context is missing. Cannot read workspace document.";
			}

			try {
				const document = await documentRepository.findById(documentId);

				if (!document) {
					return "Document not found in the workspace.";
				}

				if (document.workspaceId !== workspaceId) {
					return "Access denied: The requested document does not belong to the current workspace.";
				}

				if (!document.currentVersionId) {
					return `Document "${document.title}" is empty (no content versions found).`;
				}

				const body = await documentBodyRepository.findById(document.currentVersionId);
				const content = body?.content || "";

				const maxSafeLength = 15000;
				if (content.length > maxSafeLength) {
					const truncated = content.slice(0, 10000);
					return `[Document Title: ${document.title}] (ID: ${document.documentId})\n\n` +
						`[WARNING: This document is very large (${content.length} characters) and has been truncated to avoid token limits.]\n\n` +
						`${truncated}\n\n` +
						`[... TRUNCATED ...]\n` +
						`[Note to AI: The document content exceeds safe reading limits. If you need to inspect sections beyond the first 10,000 characters, instruct the user to view it in the editor or request specific section lines if available.]`;
				}

				return `[Document Title: ${document.title}] (ID: ${document.documentId})\n\n${content}`;
			} catch (error) {
				console.error("[WorkspaceTool] Read failed:", error);
				return "An error occurred while reading the workspace document.";
			}
		},
		{
			name: "read_workspace_document_by_id",
			description: "Read the content of a specific document in the workspace by its Document ID. Make sure to retrieve the Document ID first using search_workspace_documents.",
			schema: z.object({
				documentId: z.string().describe("The exact ID of the document to read"),
			}),
		},
	);
};

export const getActiveToolsForState = (state: { documentId?: string; workspaceId?: string }): any[] => {
	const activeTools: any[] = [semanticScholarTool];

	if (state.documentId && state.documentId !== "unknown" && state.documentId !== "") {
		activeTools.push(...createCodeMirrorTools());
		activeTools.push(createRAGTool(state.documentId));
	}

	if (state.workspaceId && state.workspaceId !== "unknown" && state.workspaceId !== "") {
		activeTools.push(searchWorkspaceDocumentsTool(state.workspaceId));
		activeTools.push(readWorkspaceDocumentByIdTool(state.workspaceId));
	}

	return activeTools;
};
