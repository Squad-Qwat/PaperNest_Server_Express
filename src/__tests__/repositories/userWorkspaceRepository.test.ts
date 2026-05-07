import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { __mockFirestore } from "../../../__mocks__/firebase-admin";
import userWorkspaceRepository from "../../repositories/userWorkspaceRepository";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
}));

describe("UserWorkspaceRepository", () => {
	const mockUserWorkspaceId = "uw-123";
	const mockData = {
		userId: "user-123",
		workspaceId: "workspace-123",
		role: "editor" as const,
		invitationStatus: "accepted" as const,
		invitedBy: "admin-123",
	};

	beforeEach(() => {
		jest.clearAllMocks();
		__mockFirestore.collection("userWorkspaces").setMockDocs([]);
	});

	describe("create", () => {
		it("should create a user-workspace link successfully", async () => {
			const result = await userWorkspaceRepository.create(mockData);

			expect(result).toMatchObject(mockData);
			expect(result.userWorkspaceId).toBeDefined();
		});
	});

	describe("findWorkspacesByUser", () => {
		it("should return workspaces for a user with specific status", async () => {
			const collection = __mockFirestore.collection("userWorkspaces");
			collection.setMockDocs([{ ...mockData, userWorkspaceId: mockUserWorkspaceId }]);

			const result = await userWorkspaceRepository.findWorkspacesByUser("user-123", "accepted");

			expect(result).toHaveLength(1);
			expect(result[0].workspaceId).toBe("workspace-123");
		});
	});

	describe("findPendingInvitations", () => {
		it("should return pending invitations for a user", async () => {
			const collection = __mockFirestore.collection("userWorkspaces");
			collection.setMockDocs([{ ...mockData, invitationStatus: "pending", userWorkspaceId: "inv-123" }]);

			const result = await userWorkspaceRepository.findPendingInvitations("user-123");

			expect(result).toHaveLength(1);
			expect(result[0].invitationStatus).toBe("pending");
		});
	});

	describe("updateInvitationStatus", () => {
		it("should update invitation status successfully", async () => {
			const docRef = __mockFirestore.collection("userWorkspaces").doc(mockUserWorkspaceId);
			await docRef.set({ ...mockData, invitationStatus: "pending", userWorkspaceId: mockUserWorkspaceId });

			const result = await userWorkspaceRepository.updateInvitationStatus(mockUserWorkspaceId, "accepted");

			expect(result.invitationStatus).toBe("accepted");
		});
	});

	describe("updateRole", () => {
		it("should update user role in workspace", async () => {
			const docRef = __mockFirestore.collection("userWorkspaces").doc(mockUserWorkspaceId);
			await docRef.set({ ...mockData, userWorkspaceId: mockUserWorkspaceId });

			const result = await userWorkspaceRepository.updateRole(mockUserWorkspaceId, "owner");

			expect(result.role).toBe("owner");
		});
	});

	describe("getUserRole", () => {
		it("should return the user's role in a workspace", async () => {
			const collection = __mockFirestore.collection("userWorkspaces");
			collection.setMockDocs([{ ...mockData, userWorkspaceId: mockUserWorkspaceId }]);

			const role = await userWorkspaceRepository.getUserRole("user-123", "workspace-123");

			expect(role).toBe("editor");
		});

		it("should return null if user is not in workspace", async () => {
			const role = await userWorkspaceRepository.getUserRole("other", "workspace-123");
			expect(role).toBeNull();
		});
	});
});
