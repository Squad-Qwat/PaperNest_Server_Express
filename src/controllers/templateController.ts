import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import { templateService } from "../services/templateService";
import logger from "../utils/logger";
import { successResponse } from "../utils/responseFormatter";

/**
 * Get all available LaTeX templates
 * GET /api/templates
 */
export const getTemplates = asyncHandler(async (req: Request, res: Response) => {
	logger.info("Get templates request");
	const templates = await templateService.listTemplates();
	return successResponse(
		res,
		{ templates, count: templates.length },
		"Templates retrieved successfully",
	);
});

/**
 * Get template by ID
 * GET /api/templates/:templateId
 */
export const getTemplateById = asyncHandler(async (req: Request, res: Response) => {
	const templateId = req.params.templateId as string;
	logger.info(`Get template request: ${templateId}`);
	
	const templates = await templateService.listTemplates();
	const metadata = templates.find(t => t.id === templateId);
	
	if (!metadata) {
		return res.status(404).json({ error: "Template not found" });
	}

	const content = await templateService.getTemplateContent(templateId);
	
	return successResponse(
		res,
		{ ...metadata, content },
		"Template retrieved successfully",
	);
});

export default {
	getTemplates,
	getTemplateById,
};
