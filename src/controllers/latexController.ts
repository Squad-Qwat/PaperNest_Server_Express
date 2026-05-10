import type { NextFunction, Request, Response } from "express";
import documentFileRepository from "../repositories/documentFileRepository";
import documentRepository from "../repositories/documentRepository";
import permissionService from "../services/permissionService";
import { latexService } from "../services/latexService";
import logger from "../utils/logger";
import {
	errorResponse,
	forbiddenResponse,
	successResponse,
} from "../utils/responseFormatter";


/**
 * Controller to handle LaTeX-related requests.
 */
export const compileLatex = async (
	req: Request,
	res: Response,
	NextFunction: NextFunction,
) => {
	const { content, mainFileName, assets, engine, documentId } = req.body;

	if (!content) {
		return errorResponse(res, "LaTeX content is required", 400);
	}


	try {
		const userId = (req as any).userId;

		logger.info(
			`[LatexController] Compilation request received for: ${mainFileName || "main.tex"} by user: ${userId}`,
		);

		let resolvedAssets = (assets || []).map((a: any) => ({
			name: a.name,
			url: a.url,
		}));

		if (documentId) {
			logger.info(`[LatexController] Verifying permissions for document: ${documentId}`);
			const document = await documentRepository.findById(documentId);
			if (!document) {
				logger.warn(`[LatexController] Document ${documentId} not found`);
				return errorResponse(res, "Document not found", 404);
			}

			const hasAccess = await permissionService.hasMinimumPermission(
				userId,
				documentId,
				document.workspaceId,
				"viewer",
			);

			if (!hasAccess) {
				logger.warn(
					`[LatexController] User ${userId} unauthorized for document ${documentId}`,
				);
				return forbiddenResponse(res, "Unauthorized access to document");
			}

			logger.info(`[LatexController] Permissions verified. Fetching assets...`);
			try {
				const dbFiles = await documentFileRepository.findByDocument(documentId);
				resolvedAssets = dbFiles.map((file) => ({
					name: file.name,
					url: file.url,
					r2Key: file.r2Key,
				}));
				logger.info(
					`[LatexController] Fetched ${resolvedAssets.length} assets from Firestore`,
				);
			} catch (dbError: any) {
				logger.warn(
					`[LatexController] Failed to fetch assets: ${dbError.message}`,
				);
			}
		}

		logger.info(`[LatexController] Starting LaTeX compilation with ${engine || "pdflatex"}...`);

		const result = await latexService.compile({
			content,
			mainFileName,
			assets: resolvedAssets,
			engine,
		});

		if (result.pdf) {
			// Stream PDF back to client
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("X-Compilation-Status", result.status.toString());
			// We also send the log in a custom header (base64 encoded as it might contain newlines/special chars)
			// Actually, standard practice for complex results is to send a JSON with the base64 PDF or Use a multipart response.
			// But here, since the user wants a simple PDF buffer, we'll send the PDF as the body.
			// If we need the logs, we can include them in headers or send a JSON.

			// Let's send a JSON response to handle both PDF and Logs in a structured way.
			// This is better for the frontend to handle potential errors and showing logs.
			return successResponse(
				res,
				{
					pdf: result.pdf.toString("base64"),
					log: result.log,
					status: result.status,
				},
				"Compilation successful",
			);
		} else {
			// Compilation failed to produce a PDF, but we still return logs
			// We provide the log in a format that the frontend can easily consume
			return errorResponse(res, "LaTeX Compilation Failed", 422, [
				{ 
					log: result.log, 
					status: result.status,
					message: "The LaTeX engine returned an error. Please check your syntax."
				},
			]);
		}

	} catch (error: any) {
		logger.error(
			`[LatexController] Error during compilation: ${error.message}`,
		);
		return errorResponse(res, "Internal Server Error", 500);
	}

};
