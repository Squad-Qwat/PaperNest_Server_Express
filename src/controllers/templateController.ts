import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import { templateService } from "../services/templateService";
import logger from "../utils/logger";
import { notFoundResponse, successResponse } from "../utils/responseFormatter";


export const getTemplates = asyncHandler(
	async (req: Request, res: Response) => {
		logger.info("Get templates request");
		const templates = await templateService.listTemplates();
		return successResponse(
			res,
			{ templates, count: templates.length },
			"Templates retrieved successfully",
		);
	},
);

export const getTemplateById = asyncHandler(
	async (req: Request, res: Response) => {
		const templateId = req.params.templateId as string;
		logger.info(`Get template request: ${templateId}`);

		const templates = await templateService.listTemplates();
		const metadata = templates.find((t) => t.id === templateId);

		if (!metadata) {
			return notFoundResponse(res, "Template not found");
		}


		const content = await templateService.getTemplateContent(templateId);

		return successResponse(
			res,
			{ ...metadata, content },
			"Template retrieved successfully",
		);
	},
);

export default {
	getTemplates,
	getTemplateById,
};
