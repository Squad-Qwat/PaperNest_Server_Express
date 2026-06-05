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

const getDocumentWithAccess = async (req: Request, res: Response, userId: string): Promise<string | null> => {
	const { documentId } = req.query;
	const docIdStr = String(documentId);
	if (!/^[a-zA-Z0-9_-]+$/.test(docIdStr)) {
		errorResponse(res, "Invalid documentId format", 400);
		return null;
	}

	const document = await documentRepository.findById(docIdStr);
	if (!document) {
		errorResponse(res, "Document not found", 404);
		return null;
	}

	const hasAccess = await permissionService.hasMinimumPermission(
		userId,
		docIdStr,
		document.workspaceId,
		"viewer",
	);

	if (!hasAccess) {
		forbiddenResponse(res, "Unauthorized access to document");
		return null;
	}

	return docIdStr;
};

export const syncToCode = async (req: Request, res: Response) => {
	const { page, x, y } = req.query;

	if (!page || !x || !y) {
		return errorResponse(res, "Missing parameters (page, x, y)", 400);
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = await getDocumentWithAccess(req, res, userId);
		if (!docIdStr) return;

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

export const syncToPdf = async (req: Request, res: Response) => {
	const { file, line, column } = req.query;

	if (!file || !line) {
		return errorResponse(res, "Missing parameters (file, line)", 400);
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = await getDocumentWithAccess(req, res, userId);
		if (!docIdStr) return;

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
