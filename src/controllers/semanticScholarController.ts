import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import { semanticScholarService } from "../services/SemanticScholarService";
import logger from "../utils/logger";
import { successResponse } from "../utils/responseFormatter";

/**
 * Search papers on Semantic Scholar
 * GET /api/semantic-scholar/search?q=query
 */
export const searchPapers = asyncHandler(
	async (req: Request, res: Response) => {
		const { q, limit, offset } = req.query;

		if (!q) {
			return res
				.status(400)
				.json({ status: "error", message: 'Query parameter "q" is required' });
		}

		logger.info(`[SemanticScholarController] Searching papers for: "${q}"`);

		const results = await semanticScholarService.searchPapers(
			q as string,
			limit ? parseInt(limit as string, 10) : 10,
			offset ? parseInt(offset as string, 10) : 0,
		);

		return successResponse(res, results, "Papers retrieved successfully");
	},
);

/**
 * Get paper details by ID
 * GET /api/semantic-scholar/paper/:id
 */
export const getPaperDetails = asyncHandler(
	async (req: Request, res: Response) => {
		const id = req.params.id as string;

		logger.info(`[SemanticScholarController] Getting paper details for: ${id}`);

		const paper = await semanticScholarService.getPaperDetails(id);

		return successResponse(
			res,
			{ paper },
			"Paper details retrieved successfully",
		);
	},
);

export default {
	searchPapers,
	getPaperDetails,
};
