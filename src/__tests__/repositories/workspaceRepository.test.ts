import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { __mockFirestore } from "../../../__mocks__/firebase-admin";
import workspaceRepository from "../../repositories/workspaceRepository";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
}));

describe("WorkspaceRepository", () => {
	const mockWorkspaceId = "workspace-123";
	const mockWorkspaceData = {
		title: "Test Workspace",
		description: "A workspace for testing",
		ownerId: "user-123",
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("create", () => {
		it("should create a new workspace successfully", async () => {
			const collection = __mockFirestore.collection("workspaces");
			
			const result = await workspaceRepository.create(mockWorkspaceData);

			expect(result).toMatchObject(mockWorkspaceData);
			expect(result.workspaceId).toBeDefined();
			expect(result.createdAt).toBeInstanceOf(Date);
		});
	});

	describe("findById", () => {
		it("should return workspace when found", async () => {
			const docRef = __mockFirestore.collection("workspaces").doc(mockWorkspaceId);
			await docRef.set({ ...mockWorkspaceData, workspaceId: mockWorkspaceId });

			const result = await workspaceRepository.findById(mockWorkspaceId);

			expect(result).toMatchObject(mockWorkspaceData);
			expect(result?.workspaceId).toBe(mockWorkspaceId);
		});

		it("should return null when workspace not found", async () => {
			const result = await workspaceRepository.findById("non-existent");
			expect(result).toBeNull();
		});
	});

	describe("update", () => {
		it("should update workspace successfully", async () => {
			const docRef = __mockFirestore.collection("workspaces").doc(mockWorkspaceId);
			await docRef.set({ ...mockWorkspaceData, workspaceId: mockWorkspaceId });

			const updates = { title: "Updated Title" };
			const result = await workspaceRepository.update(mockWorkspaceId, updates);

			expect(result.title).toBe("Updated Title");
			expect(result.workspaceId).toBe(mockWorkspaceId);
		});
	});

	describe("delete", () => {
		it("should delete workspace successfully", async () => {
			const docRef = __mockFirestore.collection("workspaces").doc(mockWorkspaceId);
			await docRef.set({ ...mockWorkspaceData, workspaceId: mockWorkspaceId });

			await workspaceRepository.delete(mockWorkspaceId);

			const found = await workspaceRepository.findById(mockWorkspaceId);
			expect(found).toBeNull();
		});
	});
});
