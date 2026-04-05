import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { __mockFirestore } from "../../../__mocks__/firebase-admin";
import { UserRepository } from "../../repositories/userRepository";
import { mockUser, mockUsers } from "../../tests/fixtures";
import { User } from "../../types";

// Mock firebase config
jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));

describe("UserRepository", () => {
	let userRepository: UserRepository;
	let mockCollection: any;

	beforeEach(() => {
		jest.clearAllMocks();
		userRepository = new UserRepository();
		mockCollection = __mockFirestore.collection("users");
	});

	describe("create", () => {
		it("should create a new user successfully", async () => {
			const userId = "user-123";
			const userData = {
				name: "John Doe",
				email: "john@example.com",
				username: "johndoe",
				role: "Student" as const,
				photoURL: null,
			};

			const result = await userRepository.create(userId, userData);

			expect(result).toMatchObject({
				userId,
				...userData,
			});
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.updatedAt).toBeInstanceOf(Date);
		});

		it("should include optional fields when provided", async () => {
			const userId = "user-456";
			const userData = {
				name: "Jane Smith",
				email: "jane@example.com",
				username: "janesmith",
				role: "Lecturer" as const,
				photoURL: "https://example.com/photo.jpg",
			};

			const result = await userRepository.create(userId, userData);

			expect(result.photoURL).toBe(userData.photoURL);
		});
	});

	describe("findById", () => {
		it("should return user when found", async () => {
			const userId = "user-123";

			const mockGet = (jest.fn() as any).mockResolvedValue({
				exists: true,
				data: () => mockUser,
			});

			mockCollection.doc = jest.fn().mockReturnValue({
				get: mockGet,
			});

			const result = await userRepository.findById(userId);

			expect(result).toEqual(mockUser);
			expect(mockCollection.doc).toHaveBeenCalledWith(userId);
			expect(mockGet).toHaveBeenCalled();
		});

		it("should return null when user not found", async () => {
			const userId = "non-existent";

			const mockGet = (jest.fn() as any).mockResolvedValue({
				exists: false,
			});

			mockCollection.doc = jest.fn().mockReturnValue({
				get: mockGet,
			});

			const result = await userRepository.findById(userId);

			expect(result).toBeNull();
		});
	});

	describe("findByEmail", () => {
		it("should return user when found by email", async () => {
			const email = "john@example.com";
			const whereSpy = jest.spyOn(mockCollection, "where");

			mockCollection.setMockDocs([mockUser]);

			const result = await userRepository.findByEmail(email);

			expect(result).toEqual(mockUser);
			expect(whereSpy).toHaveBeenCalledWith("email", "==", email);
		});

		it("should return null when user not found by email", async () => {
			const email = "nonexistent@example.com";

			mockCollection.setMockDocs([]);

			const result = await userRepository.findByEmail(email);

			expect(result).toBeNull();
		});
	});

	describe("findByUsername", () => {
		it("should return user when found by username", async () => {
			const username = "johndoe";
			const whereSpy = jest.spyOn(mockCollection, "where");

			mockCollection.setMockDocs([mockUser]);

			const result = await userRepository.findByUsername(username);

			expect(result).toEqual(mockUser);
			expect(whereSpy).toHaveBeenCalledWith("username", "==", username);
		});

		it("should return null when user not found by username", async () => {
			const username = "nonexistent";

			mockCollection.setMockDocs([]);

			const result = await userRepository.findByUsername(username);

			expect(result).toBeNull();
		});
	});

	describe("update", () => {
		it("should update user successfully", async () => {
			const userId = "user-123";
			const updates = { name: "John Updated" };
			const updatedUser = { ...mockUser, ...updates };

			const mockUpdate = (jest.fn() as any).mockResolvedValue(undefined);
			const mockGet = (jest.fn() as any).mockResolvedValue({
				exists: true,
				data: () => updatedUser,
			});

			mockCollection.doc = jest.fn().mockReturnValue({
				update: mockUpdate,
				get: mockGet,
			});

			const result = await userRepository.update(userId, updates);

			expect(result).toMatchObject(updates);
			expect(mockUpdate).toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("should delete user successfully", async () => {
			const userId = "user-123";

			const mockDelete = (jest.fn() as any).mockResolvedValue(undefined);

			mockCollection.doc = jest.fn().mockReturnValue({
				delete: mockDelete,
			});

			await userRepository.delete(userId);

			expect(mockDelete).toHaveBeenCalled();
		});
	});

	describe("search", () => {
		it("should return users matching search query", async () => {
			const query = "john";

			mockCollection.setMockDocs([mockUser]);

			const result = await userRepository.search(query);

			expect(result).toEqual([mockUser]);
		});

		it("should return empty array when no users match", async () => {
			const query = "nonexistent";

			mockCollection.setMockDocs([]);

			const result = await userRepository.search(query);

			expect(result).toEqual([]);
		});
	});
});
