import type { Request, Response } from "express";
import documentRepository from "../repositories/documentRepository";
import permissionService from "../services/permissionService";
import { synctexService } from "../services/synctexService";
import logger from "../utils/logger";
import {
	errorResponse,
	forbiddenResponse,
	successResponse,
} from "../utils/responseFormatter";

/**
 * Maps PDF coordinates (page, x, y) back to the code line.
 * GET /api/latex/sync/code?documentId=xxx&page=1&x=100&y=200
 */
export const syncToCode = async (req: Request, res: Response) => {
	const { documentId, page, x, y } = req.query;

	if (!documentId || !page || !x || !y) {
		return errorResponse(res, "Missing parameters (documentId, page, x, y)", 400);
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = String(documentId);
		if (!/^[a-zA-Z0-9_-]+$/.test(docIdStr)) {
			return errorResponse(res, "Invalid documentId format", 400);
		}

		const document = await documentRepository.findById(docIdStr);
		if (!document) {
			return errorResponse(res, "Document not found", 404);
		}

		const hasAccess = await permissionService.hasMinimumPermission(
			userId,
			docIdStr,
			document.workspaceId,
			"viewer",
		);

		if (!hasAccess) {
			return forbiddenResponse(res, "Unauthorized access to document");
		}

		const result = await synctexService.syncToCode(
			docIdStr,
			parseInt(String(page), 10),
			parseFloat(String(x)),
			parseFloat(String(y)),
		);

		if (!result) {
			return errorResponse(res, "Could not map PDF coordinates to source code", 422);
		}

		return successResponse(res, result, "Sync coordinates to code successful");
	} catch (error: any) {
		logger.error(`[LatexSyncController] syncToCode error: ${error.message}`);
		return errorResponse(res, "Internal Server Error", 500);
	}
};

/**
 * Maps source file line/column back to PDF page coordinates.
 * GET /api/latex/sync/pdf?documentId=xxx&file=main.tex&line=15&column=1
 */
export const syncToPdf = async (req: Request, res: Response) => {
	const { documentId, file, line, column } = req.query;

	if (!documentId || !file || !line) {
		return errorResponse(res, "Missing parameters (documentId, file, line)", 400);
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = String(documentId);
		if (!/^[a-zA-Z0-9_-]+$/.test(docIdStr)) {
			return errorResponse(res, "Invalid documentId format", 400);
		}

		const document = await documentRepository.findById(docIdStr);
		if (!document) {
			return errorResponse(res, "Document not found", 404);
		}

		const hasAccess = await permissionService.hasMinimumPermission(
			userId,
			docIdStr,
			document.workspaceId,
			"viewer",
		);

		if (!hasAccess) {
			return forbiddenResponse(res, "Unauthorized access to document");
		}

		const colVal = column ? parseInt(String(column), 10) : 0;
		const result = await synctexService.syncToPdf(
			docIdStr,
			String(file),
			parseInt(String(line), 10),
			colVal,
		);

		if (!result) {
			return errorResponse(res, "Could not map source line to PDF coordinates", 422);
		}

		return successResponse(res, result, "Sync code to PDF coordinates successful");
	} catch (error: any) {
		logger.error(`[LatexSyncController] syncToPdf error: ${error.message}`);
		return errorResponse(res, "Internal Server Error", 500);
	}
};
