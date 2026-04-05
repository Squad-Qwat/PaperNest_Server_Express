import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ragService } from "../rag/rag.service";

/**
 * RAG Tool for AI Agents
 * Allows agents to search through attached PDF documents for context
 */
export const createRAGTool = (documentId: string) => {
	return tool(
		async ({ query, maxChunks = 5 }) => {
			console.log(
				`[RAGTool] Searching for: "${query}" in document ${documentId}`,
			);

			try {
				const results = await ragService.search(documentId, query, maxChunks);

				if (results.length === 0) {
					return "No relevant information found in attached PDF documents. If you need more info, try a different search query or use standard document editing tools.";
				}

				const formattedResults = results
					.map((chunk, idx) => {
						return `[Source: ${chunk.fileKey.split("/").pop()} (Chunk ${chunk.chunkIndex})]\n${chunk.text}`;
					})
					.join("\n\n---\n\n");

				return `Relevant excerpts found in attached PDFs:\n\n${formattedResults}`;
			} catch (error) {
				console.error("[RAGTool] Search failed:", error);
				return "Error searching attached PDFs. Please proceed with current document context.";
			}
		},
		{
			name: "search_attached_pdfs",
			description:
				"Search through the content of all uploaded PDF files attached to this document. Use this when the user asks questions about existing research, data, or content that might be in their attached PDF references.",
			schema: z.object({
				query: z
					.string()
					.describe("The search query or keywords to look for in the PDFs"),
				maxChunks: z
					.number()
					.optional()
					.default(5)
					.describe("Maximum number of relevant excerpts to return"),
			}),
		},
	);
};
