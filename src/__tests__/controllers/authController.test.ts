import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import authController from "../../controllers/authController";
import * as authService from "../../services/authService";
import { mockUser } from "../../tests/fixtures";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));
jest.mock("../../services/authService");
jest.mock("../../utils/logger");

describe("AuthController", () => {
	let mockReq: any;
	let mockRes: any;
	let next: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		mockReq = {
			body: {},
			params: {},
			query: {},
			userId: "user-123",
			user: mockUser as any,
		};
		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
	});

	describe("register", () => {
		it("should register a user and return 201", async () => {
			const result = { isVerificationRequired: true, firebaseToken: "token" };
			jest.mocked(authService.register).mockResolvedValue(result);
			mockReq.body = { email: "test@example.com" };

			await authController.register(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: result,
			}));
		});
	});

	describe("login", () => {
		it("should login user and return 200", async () => {
			const result = { user: mockUser, token: "token" };
			jest.mocked(authService.login).mockResolvedValue(result);
			mockReq.body = { firebaseToken: "firebase-token" };

			await authController.login(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: result,
			}));
		});
	});

	describe("getCurrentUser", () => {
		it("should return current user from request object", async () => {
			await authController.getCurrentUser(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: { user: mockUser },
			}));
		});
	});

	describe("deleteAccount", () => {
		it("should delete account and return 204", async () => {
			jest.mocked(authService.deleteUser).mockResolvedValue(undefined as any);

			await authController.deleteAccount(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(204);
		});

		it("should throw error if userId is missing", async () => {
			mockReq.userId = undefined;
			await authController.deleteAccount(mockReq as Request, mockRes as Response, next);
			expect(next).toHaveBeenCalledWith(expect.any(Error));
		});
	});

	describe("checkEmail", () => {
		it("should check email availability", async () => {
			const result = { available: true };
			jest.mocked(authService.checkEmailAvailability).mockResolvedValue(result);
			mockReq.body = { email: "new@example.com" };

			await authController.checkEmail(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: result,
			}));
		});
	});
});
