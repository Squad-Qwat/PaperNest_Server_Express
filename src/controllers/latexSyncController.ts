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

	const pageStr = String(page);
	const xStr = String(x);
	const yStr = String(y);

	if (!/^\d+$/.test(pageStr)) {
		return errorResponse(res, "Invalid page parameter format", 400);
	}
	if (!/^[+-]?([0-9]*[.])?[0-9]+$/.test(xStr)) {
		return errorResponse(res, "Invalid x coordinate format", 400);
	}
	if (!/^[+-]?([0-9]*[.])?[0-9]+$/.test(yStr)) {
		return errorResponse(res, "Invalid y coordinate format", 400);
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = await getDocumentWithAccess(req, res, userId);
		if (!docIdStr) return;

		const result = await synctexService.syncToCode(
			docIdStr,
			parseInt(pageStr, 10),
			parseFloat(xStr),
			parseFloat(yStr),
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

	const fileStr = String(file);
	const lineStr = String(line);

	const safeFileRegex = /^[a-zA-Z0-9_][a-zA-Z0-9_\-\.\/]*$/;
	if (!safeFileRegex.test(fileStr) || fileStr.includes("..") || fileStr.startsWith("-")) {
		return errorResponse(res, "Invalid file parameter format", 400);
	}

	const sanitizedFile = fileStr.replace(/[^a-zA-Z0-9_\-\.\/]/g, "");

	if (!/^\d+$/.test(lineStr)) {
		return errorResponse(res, "Invalid line parameter format", 400);
	}

	if (column) {
		const colStr = String(column);
		if (!/^\d+$/.test(colStr)) {
			return errorResponse(res, "Invalid column parameter format", 400);
		}
	}

	try {
		const userId = (req as any).userId;
		const docIdStr = await getDocumentWithAccess(req, res, userId);
		if (!docIdStr) return;

		const colVal = column ? parseInt(String(column), 10) : 0;
		const result = await synctexService.syncToPdf(
			docIdStr,
			sanitizedFile,
			parseInt(lineStr, 10),
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
