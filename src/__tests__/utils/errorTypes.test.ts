import { describe, expect, it } from "@jest/globals";
import {
	AppError,
	BadRequestError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
} from "../../utils/errorTypes";

describe("Error Types", () => {
	describe("AppError", () => {
		it("should create custom error with message and status code", () => {
			const error = new AppError("Custom error", 500);

			expect(error.message).toBe("Custom error");
			expect(error.statusCode).toBe(500);
			expect(error.isOperational).toBe(true);
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(AppError);
		});

		it("should be catchable as Error", () => {
			try {
				throw new AppError("Test error", 500);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as AppError).statusCode).toBe(500);
			}
		});
	});

	describe("BadRequestError", () => {
		it("should create 400 error with default message", () => {
			const error = new BadRequestError();

			expect(error.message).toBe("Bad request");
			expect(error.statusCode).toBe(400);
			expect(error.isOperational).toBe(true);
		});

		it("should create 400 error with custom message", () => {
			const error = new BadRequestError("Invalid input data");

			expect(error.message).toBe("Invalid input data");
			expect(error.statusCode).toBe(400);
		});
	});

	describe("UnauthorizedError", () => {
		it("should create 401 error with default message", () => {
			const error = new UnauthorizedError();

			expect(error.message).toBe("Unauthorized access");
			expect(error.statusCode).toBe(401);
			expect(error.isOperational).toBe(true);
		});

		it("should create 401 error with custom message", () => {
			const error = new UnauthorizedError("Invalid token");

			expect(error.message).toBe("Invalid token");
			expect(error.statusCode).toBe(401);
		});
	});

	describe("ForbiddenError", () => {
		it("should create 403 error with default message", () => {
			const error = new ForbiddenError();

			expect(error.message).toBe("Access forbidden");
			expect(error.statusCode).toBe(403);
			expect(error.isOperational).toBe(true);
		});

		it("should create 403 error with custom message", () => {
			const error = new ForbiddenError("Insufficient permissions");

			expect(error.message).toBe("Insufficient permissions");
			expect(error.statusCode).toBe(403);
		});
	});

	describe("NotFoundError", () => {
		it("should create 404 error with default message", () => {
			const error = new NotFoundError();

			expect(error.message).toBe("Resource not found");
			expect(error.statusCode).toBe(404);
			expect(error.isOperational).toBe(true);
		});

		it("should create 404 error with custom message", () => {
			const error = new NotFoundError("User not found");

			expect(error.message).toBe("User not found");
			expect(error.statusCode).toBe(404);
		});
	});

	describe("ConflictError", () => {
		it("should create 409 error with default message", () => {
			const error = new ConflictError();

			expect(error.message).toBe("Resource conflict");
			expect(error.statusCode).toBe(409);
			expect(error.isOperational).toBe(true);
		});

		it("should create 409 error with custom message", () => {
			const error = new ConflictError("Email already exists");

			expect(error.message).toBe("Email already exists");
			expect(error.statusCode).toBe(409);
		});
	});

	describe("Error inheritance", () => {
		it("should all extend AppError", () => {
			const errors = [
				new BadRequestError(),
				new UnauthorizedError(),
				new ForbiddenError(),
				new NotFoundError(),
				new ConflictError(),
			];

			errors.forEach((error) => {
				expect(error).toBeInstanceOf(AppError);
				expect(error).toBeInstanceOf(Error);
				expect(error.isOperational).toBe(true);
			});
		});

		it("should have unique status codes", () => {
			const statusCodes = [
				new BadRequestError().statusCode,
				new UnauthorizedError().statusCode,
				new ForbiddenError().statusCode,
				new NotFoundError().statusCode,
				new ConflictError().statusCode,
			];

			const uniqueCodes = new Set(statusCodes);
			expect(uniqueCodes.size).toBe(statusCodes.length);
		});
	});
});
