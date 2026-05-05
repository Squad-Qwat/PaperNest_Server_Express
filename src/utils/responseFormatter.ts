import type { Response } from "express";
import { HTTP_STATUS } from "../config/constants";

export interface ApiResponse<T = any> {
	success: boolean;
	message?: string;
	data?: T;
	error?: string;
	errors?: any[];
	meta?: {
		page?: number;
		limit?: number;
		total?: number;
		totalPages?: number;
	};
}

/**
 * Send success response
 */
export const successResponse = <T = any>(
	res: Response,
	data?: T,
	message?: string,
	statusCode: number = HTTP_STATUS.OK,
	meta?: any,
): Response => {
	const response: ApiResponse<T> = {
		success: true,
		message,
		data,
		meta,
	};

	return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
export const errorResponse = (
	res: Response,
	message: string,
	statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
	errors?: any[],
): Response => {
	const response: ApiResponse = {
		success: false,
		error: message,
		errors,
	};

	return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 */
export const validationErrorResponse = (
	res: Response,
	errors: any[],
): Response => {
	return errorResponse(
		res,
		"Validation failed",
		HTTP_STATUS.UNPROCESSABLE_ENTITY,
		errors,
	);
};

/**
 * Send not found response
 */
export const notFoundResponse = (
	res: Response,
	message: string = "Resource not found",
): Response => {
	return errorResponse(res, message, HTTP_STATUS.NOT_FOUND);
};

/**
 * Send unauthorized response
 */
export const unauthorizedResponse = (
	res: Response,
	message: string = "Unauthorized access",
): Response => {
	return errorResponse(res, message, HTTP_STATUS.UNAUTHORIZED);
};

/**
 * Send forbidden response
 */
export const forbiddenResponse = (
	res: Response,
	message: string = "Access forbidden",
): Response => {
	return errorResponse(res, message, HTTP_STATUS.FORBIDDEN);
};

/**
 * Send created response
 */
export const createdResponse = <T = any>(
	res: Response,
	data?: T,
	message?: string,
): Response => {
	return successResponse(res, data, message, HTTP_STATUS.CREATED);
};

/**
 * Send no content response
 */
export const noContentResponse = (res: Response): Response => {
	return res.status(HTTP_STATUS.NO_CONTENT).send();
};

/**
 * Send paginated response
 */
export const paginatedResponse = <T = any>(
	res: Response,
	data: T[],
	page: number,
	limit: number,
	total: number,
	message?: string,
): Response => {
	const totalPages = Math.ceil(total / limit);

	return successResponse(res, data, message, HTTP_STATUS.OK, {
		page,
		limit,
		total,
		totalPages,
	});
};
