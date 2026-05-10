import type { Request, Response } from "express";
import { HTTP_STATUS } from "../config/constants";
import { errorResponse, successResponse } from "../utils/responseFormatter";

/**
 * Controller for RAG indexing operations
 */
export const indexPDF = async (req: Request, res: Response): Promise<void> => {
	try {
		const { documentId, fileKey } = req.body;

		if (!documentId || !fileKey) {
			errorResponse(res, "documentId and fileKey are required", HTTP_STATUS.BAD_REQUEST);
			return;
		}

		// DYNAMIC IMPORT: Load RAG service only when indexing is requested
		const { ragService } = await import("../services/ai/rag/rag.service");

		// Run indexing in background to not block the response
		ragService
			.indexPDF(documentId, fileKey)
			.then(() => {
				console.log(`[RAGController] Indexing success for ${fileKey}`);
			})
			.catch((err) => {
				console.error(
					`[RAGController] Indexing background error for ${fileKey}:`,
					err,
				);
			});

		successResponse(
			res,
			{ documentId, fileKey },
			"PDF indexing started in background",
			HTTP_STATUS.OK,
		);

	} catch (error: any) {
		console.error("[RAGController] Error starting indexing:", error);
		errorResponse(
			res,
			"Failed to start indexing",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			error instanceof Error ? [error.message] : undefined,
		);

	}
};
