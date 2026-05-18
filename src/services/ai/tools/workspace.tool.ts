import { tool } from "@langchain/core/tools";
import { z } from "zod";
import documentRepository from "../../../repositories/documentRepository";
import documentBodyRepository from "../../../repositories/documentBodyRepository";
import { createCodeMirrorTools } from "./schemas";
import { createRAGTool } from "./rag.tool";
import { semanticScholarTool } from "./semanticScholar.tool";
import { ragService } from "../rag/rag.service";

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

export const searchDocumentLinesBackendTool = (workspaceId: string) => {
	return tool(
		async ({ documentId, query, caseSensitive }) => {
			try {
				const document = await documentRepository.findById(documentId);
				if (!document || document.workspaceId !== workspaceId) {
					return "Document not found in this workspace.";
				}
				if (!document.currentVersionId) {
					return "Document has no content version.";
				}

				const body = await documentBodyRepository.findById(document.currentVersionId);
				const content = body?.content || "";

				const lines = content.split("\n");
				const matches: { line: number; text: string }[] = [];
				const lowercaseQuery = query.toLowerCase();

				lines.forEach((lineText: string, idx: number) => {
					const match = caseSensitive
						? lineText.includes(query)
						: lineText.toLowerCase().includes(lowercaseQuery);
					if (match) {
						matches.push({ line: idx + 1, text: lineText });
					}
				});

				if (matches.length === 0) {
					return `No lines matching "${query}" were found in document "${document.title}".`;
				}

				const formatted = matches
					.slice(0, 50)
					.map((m) => `Line ${m.line}: ${m.text}`)
					.join("\n");

				return `Found matching lines in document "${document.title}":\n\n${formatted}`;
			} catch (error) {
				return "Error searching document lines on backend.";
			}
		},
		{
			name: "search_document_lines_backend",
			description: "Search for specific text inside a LaTeX document by line content on the server database. Use this in the AI Dashboard to locate lines of interest without opening the client editor.",
			schema: z.object({
				documentId: z.string().describe("The exact ID of the document to search"),
				query: z.string().describe("Text to search for"),
				caseSensitive: z.boolean().optional().default(false).describe("Case-sensitive match"),
			}),
		},
	);
};

export const readDocumentLinesBackendTool = (workspaceId: string) => {
	return tool(
		async ({ documentId, fromLine, toLine }) => {
			try {
				const document = await documentRepository.findById(documentId);
				if (!document || document.workspaceId !== workspaceId) {
					return "Document not found in this workspace.";
				}
				if (!document.currentVersionId) {
					return "Document has no content version.";
				}

				const body = await documentBodyRepository.findById(document.currentVersionId);
				const content = body?.content || "";

				const lines = content.split("\n");
				const start = Math.max(1, fromLine || 1);
				const end = Math.min(lines.length, toLine || Math.min(lines.length, start + 49));

				if (start > lines.length) {
					return `Invalid line range. Document only has ${lines.length} lines.`;
				}

				const slice = lines.slice(start - 1, end);
				const formatted = slice.map((lineText: string, idx: number) => `Line ${start + idx}: ${lineText}`).join("\n");

				return `Document "${document.title}" (Lines ${start} to ${end}):\n\n${formatted}`;
			} catch (error) {
				return "Error reading document lines from server database.";
			}
		},
		{
			name: "read_document_lines_backend",
			description: "Read a specific range of lines from a document's LaTeX source code directly from the server database. Use this in the AI Dashboard to inspect parts of documents without opening the editor.",
			schema: z.object({
				documentId: z.string().describe("The exact ID of the document to read"),
				fromLine: z.number().optional().default(1).describe("Start line (1-based)"),
				toLine: z.number().optional().describe("End line (inclusive)"),
			}),
		},
	);
};

export const searchWorkspacePdfsRagTool = (workspaceId: string) => {
	return tool(
		async ({ query, maxChunks = 5 }) => {
			if (!workspaceId || workspaceId === "unknown") {
				return "Workspace context is missing. Cannot search workspace PDFs.";
			}

			try {
				const results = await ragService.searchWorkspace(workspaceId, query, maxChunks);

				if (results.length === 0) {
					return `No relevant information matching "${query}" was found in workspace PDFs.`;
				}

				const formatted = results.map((chunk) => {
					return `[Source PDF: ${chunk.fileKey.split("/").pop()} (Page ${chunk.pageNumber}, Chunk ${chunk.chunkIndex})]\n${chunk.text}`;
				}).join("\n\n---\n\n");

				return `Relevant excerpts found across workspace PDFs matching "${query}":\n\n${formatted}`;
			} catch (error) {
				console.error("[WorkspaceTool] Workspace RAG failed:", error);
				return "An error occurred while searching workspace PDFs.";
			}
		},
		{
			name: "search_workspace_pdfs_rag",
			description: "Search semantically through all uploaded PDF documents and references attached within the current workspace. Use this when the user asks general questions about papers, research papers, or background facts across their workspace documents.",
			schema: z.object({
				query: z.string().describe("The semantic search query or keywords to find in workspace PDFs"),
				maxChunks: z.number().optional().default(5).describe("Maximum number of snippets to retrieve"),
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
		activeTools.push(searchDocumentLinesBackendTool(state.workspaceId));
		activeTools.push(readDocumentLinesBackendTool(state.workspaceId));
		activeTools.push(searchWorkspacePdfsRagTool(state.workspaceId));
	}

	return activeTools;
};
