import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import citationRepository from "../repositories/citationRepository";
import { NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../utils/responseFormatter";

/**
 * Create a new citation in user's library
 * POST /api/citations
 * Protected
 */
export const createCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const citationData = req.body;

		logger.info("Create global citation request", { userId });

		const citation = await citationRepository.createGlobalCitation(
			userId,
			citationData
		);

		return createdResponse(res, { citation }, "Citation created successfully in library");
	},
);

/**
 * Get all citations for a user (with optional pagination)
 * GET /api/citations
 * Protected
 */
export const getCitations = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const page = parseInt(req.query.page as string) || 1;
		const limit = parseInt(req.query.limit as string) || 10;

		logger.info("Get user citations request", { userId, page, limit });

		// Use the new pagination method
		const result = await citationRepository.getAllByPagination(userId, page, limit);

		return successResponse(
			res,
			result,
			"Citations retrieved successfully",
		);
	},
);

/**
 * Get citation by ID
 * GET /api/citations/:citationId
 * Protected
 */
export const getCitationById = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const citationId = req.params.citationId as string;

		logger.info("Get user citation by ID request", { userId, citationId });

		const citation = await citationRepository.findUserCitationById(userId, citationId);

		if (!citation) {
			throw new NotFoundError("Citation not found or unauthorized");
		}

		return successResponse(
			res,
			{ citation },
			"Citation retrieved successfully",
		);
	},
);

/**
 * Update citation
 * PUT /api/citations/:citationId
 * Protected
 */
export const updateCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const citationId = req.params.citationId as string;
		const updates = req.body;

		logger.info("Update user citation request", { userId, citationId });

		const citation = await citationRepository.updateUserCitation(userId, citationId, updates);

		return successResponse(res, { citation }, "Citation updated successfully");
	},
);

/**
 * Delete citation
 * DELETE /api/citations/:citationId
 * Protected
 */
export const deleteCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const citationId = req.params.citationId as string;

		logger.info("Delete user citation request", { userId, citationId });

		const success = await citationRepository.deleteUserCitation(userId, citationId);
		
		if (!success) {
			throw new NotFoundError("Citation not found or unauthorized");
		}

		return noContentResponse(res);
	},
);

/**
 * Search user's citations by title or author
 * GET /api/citations/search?q=query
 * Protected
 */
export const searchCitations = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const q = req.query.q as string;
		const limit = parseInt(req.query.limit as string) || 10;

		logger.info("Search user citations request", { userId, query: q });

		const citations = await citationRepository.searchCitationsByUser(userId, q, limit);

		return successResponse(
			res,
			{ citations, count: citations.length },
			"Citations searched successfully",
		);
	},
);

/**
 * Find citation by DOI in user's library
 * GET /api/citations/doi/:doi
 * Protected
 */
export const getCitationByDOI = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const doi = req.params.doi as string;

		logger.info("Get user citation by DOI request", { userId, doi });

		const citation = await citationRepository.findUserCitationByDoi(userId, doi);

		if (!citation) {
			throw new NotFoundError("Citation with this DOI not found in your library");
		}

		return successResponse(
			res,
			{ citation },
			"Citation retrieved successfully",
		);
	},
);

export default {
	createCitation,
	getCitations,
	getCitationById,
	updateCitation,
	deleteCitation,
	searchCitations,
	getCitationByDOI,
};
