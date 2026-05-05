import type { Request, Response } from "express";
import { HTTP_STATUS } from "../config/constants";
import { ragService } from "../services/ai/rag/rag.service";

/**
 * Controller for RAG indexing operations
 */
export const indexPDF = async (req: Request, res: Response): Promise<void> => {
	try {
		const { documentId, fileKey } = req.body;

		if (!documentId || !fileKey) {
			res
				.status(HTTP_STATUS.BAD_REQUEST)
				.json({ error: "documentId and fileKey are required" });
			return;
		}

		// Run indexing in background to not block the response
		// In a production environment, this should be a background job / queue
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

		res.status(HTTP_STATUS.OK).json({
			message: "PDF indexing started in background",
			documentId,
			fileKey,
		});
	} catch (error: any) {
		console.error("[RAGController] Error starting indexing:", error);
		res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
			error: "Failed to start indexing",
			details: error.message,
		});
	}
};
