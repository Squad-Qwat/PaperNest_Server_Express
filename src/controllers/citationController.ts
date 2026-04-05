import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import citationRepository from "../repositories/citationRepository";
import type { Citation } from "../types";
import { NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../utils/responseFormatter";

/**
 * Create a new citation
 * POST /api/documents/:documentId/citations
 * Protected (requires edit permission)
 */
export const createCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const citationData = req.body;

		logger.info("Create citation request", { documentId });

		const citation = await citationRepository.create({
			documentId,
			...citationData,
		});

		return createdResponse(res, { citation }, "Citation created successfully");
	},
);

/**
 * Get all citations for a document
 * GET /api/documents/:documentId/citations
 * Protected (requires document access)
 */
export const getDocumentCitations = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const type = req.query.type as string | undefined;

		logger.info("Get document citations request", { documentId, type });

		let citations: Citation[];

		if (type) {
			citations = await citationRepository.findByType(documentId, type);
		} else {
			citations = await citationRepository.findByDocument(documentId);
		}

		return successResponse(
			res,
			{ citations, count: citations.length },
			"Citations retrieved successfully",
		);
	},
);

/**
 * Get citation by ID
 * GET /api/documents/:documentId/citations/:citationId
 * Protected (requires document access)
 */
export const getCitationById = asyncHandler(
	async (req: Request, res: Response) => {
		const citationId = req.params.citationId as string;

		logger.info("Get citation request", { citationId });

		const citation = await citationRepository.findById(citationId);

		if (!citation) {
			throw new NotFoundError("Citation not found");
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
 * PUT /api/documents/:documentId/citations/:citationId
 * Protected (requires edit permission)
 */
export const updateCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const citationId = req.params.citationId as string;
		const updates = req.body;

		logger.info("Update citation request", { citationId, updates });

		const citation = await citationRepository.update(citationId, updates);

		return successResponse(res, { citation }, "Citation updated successfully");
	},
);

/**
 * Delete citation
 * DELETE /api/documents/:documentId/citations/:citationId
 * Protected (requires edit permission)
 */
export const deleteCitation = asyncHandler(
	async (req: Request, res: Response) => {
		const citationId = req.params.citationId as string;

		logger.info("Delete citation request", { citationId });

		await citationRepository.delete(citationId);

		return noContentResponse(res);
	},
);

/**
 * Search citations by title or author
 * GET /api/documents/:documentId/citations/search?q=query
 * Protected (requires document access)
 */
export const searchCitations = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const q = req.query.q as string;

		logger.info("Search citations request", { documentId, query: q });

		const citations = await citationRepository.search(documentId, q);

		return successResponse(
			res,
			{ citations, count: citations.length },
			"Citations retrieved successfully",
		);
	},
);

/**
 * Find citation by DOI
 * GET /api/documents/:documentId/citations/doi/:doi
 * Protected (requires document access)
 */
export const getCitationByDOI = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const doi = req.params.doi as string;

		logger.info("Get citation by DOI request", { documentId, doi });

		const citation = await citationRepository.findByDoi(documentId, doi);

		if (!citation) {
			throw new NotFoundError("Citation not found");
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
	getDocumentCitations,
	getCitationById,
	updateCitation,
	deleteCitation,
	searchCitations,
	getCitationByDOI,
};
