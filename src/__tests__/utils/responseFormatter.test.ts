import { beforeEach, describe, expect, it } from "@jest/globals";
import type { Response } from "express";
import { mockResponse } from "../../tests/mocks/express.mocks";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../../utils/responseFormatter";

describe("Response Formatter Utilities", () => {
	let res: Partial<Response>;

	beforeEach(() => {
		res = mockResponse();
	});

	describe("successResponse", () => {
		it("should format success response with data", () => {
			const data = { user: { id: "123", name: "John" } };
			const message = "User retrieved successfully";

			successResponse(res as Response, data, message);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message,
				data,
			});
		});

		it("should format success response without message", () => {
			const data = { items: [] };

			successResponse(res as Response, data);

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: undefined,
				data,
				meta: undefined,
			});
		});

		it("should handle empty data object", () => {
			successResponse(res as Response, {});

			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: undefined,
				data: {},
				meta: undefined,
			});
		});
	});

	describe("createdResponse", () => {
		it("should format created response with data", () => {
			const data = { document: { id: "doc-123", title: "New Doc" } };
			const message = "Document created successfully";

			createdResponse(res as Response, data, message);

			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message,
				data,
			});
		});

		it("should use default message when not provided", () => {
			const data = { workspace: { id: "ws-123" } };

			createdResponse(res as Response, data);

			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: undefined,
				data,
				meta: undefined,
			});
		});
	});

	describe("noContentResponse", () => {
		it("should send 204 status with no content", () => {
			noContentResponse(res as Response);

			expect(res.status).toHaveBeenCalledWith(204);
			expect(res.send).toHaveBeenCalled();
		});

		it("should not send any JSON data", () => {
			noContentResponse(res as Response);

			expect(res.json).not.toHaveBeenCalled();
		});
	});
});
