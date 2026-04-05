import { HTTP_STATUS } from "../config/constants";

/**
 * Base error class
 */
export class AppError extends Error {
	public statusCode: number;
	public isOperational: boolean;

	constructor(
		message: string,
		statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
	) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = true;

		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Bad Request Error (400)
 */
export class BadRequestError extends AppError {
	constructor(message: string = "Bad request") {
		super(message, HTTP_STATUS.BAD_REQUEST);
	}
}

/**
 * Unauthorized Error (401)
 */
export class UnauthorizedError extends AppError {
	constructor(message: string = "Unauthorized access") {
		super(message, HTTP_STATUS.UNAUTHORIZED);
	}
}

/**
 * Forbidden Error (403)
 */
export class ForbiddenError extends AppError {
	constructor(message: string = "Access forbidden") {
		super(message, HTTP_STATUS.FORBIDDEN);
	}
}

/**
 * Not Found Error (404)
 */
export class NotFoundError extends AppError {
	constructor(message: string = "Resource not found") {
		super(message, HTTP_STATUS.NOT_FOUND);
	}
}

/**
 * Conflict Error (409)
 */
export class ConflictError extends AppError {
	constructor(message: string = "Resource conflict") {
		super(message, HTTP_STATUS.CONFLICT);
	}
}

/**
 * Validation Error (422)
 */
export class ValidationError extends AppError {
	public errors: any[];

	constructor(message: string = "Validation failed", errors: any[] = []) {
		super(message, HTTP_STATUS.UNPROCESSABLE_ENTITY);
		this.errors = errors;
	}
}

/**
 * Internal Server Error (500)
 */
export class InternalServerError extends AppError {
	constructor(message: string = "Internal server error") {
		super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
	}
}
