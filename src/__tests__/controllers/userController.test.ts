import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import userController from "../../controllers/userController";
import userRepository from "../../repositories/userRepository";
import { mockUser, mockUsers } from "../../tests/fixtures";

jest.mock("../../config/firebase", () => {
	const mock = require("../../../__mocks__/firebase-admin");
	return {
		db: mock.__mockFirestore,
		auth: mock.__mockAuth,
		storage: mock.__mockStorage,
		firebaseAdmin: mock.default,
		default: mock.default,
	};
});
jest.mock("../../repositories/userRepository");
jest.mock("../../utils/logger");

describe("UserController", () => {
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
		};
		mockRes = {
			status: jest.fn().mockReturnThis(),
			json: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
	});

	describe("getUserById", () => {
		it("should return user if found", async () => {
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);
			mockReq.params = { userId: "user-123" };

			await userController.getUserById(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: { user: mockUser },
			}));
		});

		it("should throw NotFoundError if user not found", async () => {
			jest.mocked(userRepository.findById).mockResolvedValue(null);
			mockReq.params = { userId: "non-existent" };

			await userController.getUserById(mockReq as Request, mockRes as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(Error));
			const error = next.mock.calls[0][0] as any;
			expect(error.message).toBe("User not found");
		});
	});

	describe("searchUsers", () => {
		it("should return list of users matching query", async () => {
			jest.mocked(userRepository.search).mockResolvedValue(mockUsers);
			mockReq.query = { q: "john" };

			await userController.searchUsers(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: expect.objectContaining({
					users: mockUsers,
					count: mockUsers.length,
				}),
			}));
		});
	});

	describe("updateUser", () => {
		it("should update user if authorized", async () => {
			const updates = { name: "John Updated" };
			const updatedUser = { ...mockUser, ...updates };
			jest.mocked(userRepository.findByUsername).mockResolvedValue(null);
			jest.mocked(userRepository.update).mockResolvedValue(updatedUser);
			mockReq.params = { userId: "user-123" };
			mockReq.userId = "user-123";
			mockReq.body = updates;

			await userController.updateUser(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: { user: updatedUser },
			}));
		});

		it("should throw error if updating another user's profile", async () => {
			mockReq.params = { userId: "other-user" };
			mockReq.userId = "user-123";

			await userController.updateUser(mockReq as Request, mockRes as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(Error));
			const error = next.mock.calls[0][0] as any;
			expect(error.message).toBe("You can only update your own profile");
		});
	});

	describe("deleteUser", () => {
		it("should delete user if authorized", async () => {
			jest.mocked(userRepository.delete).mockResolvedValue(undefined as any);
			mockReq.params = { userId: "user-123" };
			mockReq.userId = "user-123";

			await userController.deleteUser(mockReq as Request, mockRes as Response, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				message: "User deleted successfully",
			}));
		});
	});
});
