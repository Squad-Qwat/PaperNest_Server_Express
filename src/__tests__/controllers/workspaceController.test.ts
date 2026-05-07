import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import workspaceController from "../../controllers/workspaceController";
import workspaceRepository from "../../repositories/workspaceRepository";
import userWorkspaceRepository from "../../repositories/userWorkspaceRepository";
import userRepository from "../../repositories/userRepository";
import notificationRepository from "../../repositories/notificationRepository";
import { mockUser, mockWorkspace } from "../../tests/fixtures";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));
jest.mock("../../repositories/workspaceRepository");
jest.mock("../../repositories/userWorkspaceRepository");
jest.mock("../../repositories/userRepository");
jest.mock("../../repositories/notificationRepository");
jest.mock("../../utils/logger");

import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/errorTypes";

describe("WorkspaceController", () => {
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
			send: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
	});

	describe("createWorkspace", () => {
		it("should create a workspace and add owner successfully", async () => {
			mockReq.body = { title: "New Workspace" };
			jest.mocked(workspaceRepository.create).mockResolvedValue(mockWorkspace);
			jest.mocked(userWorkspaceRepository.create).mockResolvedValue({} as any);

			await workspaceController.createWorkspace(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(workspaceRepository.create).toHaveBeenCalled();
			expect(userWorkspaceRepository.create).toHaveBeenCalledWith(expect.objectContaining({
				role: "owner",
				invitationStatus: "accepted",
			}));
		});
	});

	describe("inviteMember", () => {
		it("should invite a user and create a notification", async () => {
			mockReq.params = { workspaceId: "workspace-123" };
			mockReq.body = { userId: "invited-user", role: "editor" };
			
			jest.mocked(userRepository.findById).mockResolvedValue({ userId: "invited-user" } as any);
			jest.mocked(userWorkspaceRepository.findByUserAndWorkspace).mockResolvedValue(null);
			jest.mocked(userWorkspaceRepository.create).mockResolvedValue({ userWorkspaceId: "uw-123" } as any);
			jest.mocked(workspaceRepository.findById).mockResolvedValue(mockWorkspace);

			await workspaceController.inviteMember(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(userWorkspaceRepository.create).toHaveBeenCalledWith(expect.objectContaining({
				invitationStatus: "pending",
			}));
			expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
				type: "invitation",
			}));
		});

		it("should throw ConflictError if user is already a member", async () => {
			mockReq.params = { workspaceId: "workspace-123" };
			mockReq.body = { userId: "invited-user" };
			
			jest.mocked(userRepository.findById).mockResolvedValue({ userId: "invited-user" } as any);
			jest.mocked(userWorkspaceRepository.findByUserAndWorkspace).mockResolvedValue({} as any);

			await workspaceController.inviteMember(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
		});
	});

	describe("getPendingInvitations", () => {
		it("should return pending invitations for user", async () => {
			const mockPending = [{ workspaceId: "workspace-123", invitedBy: "admin", userWorkspaceId: "uw-1" }];
			jest.mocked(userWorkspaceRepository.findPendingInvitations).mockResolvedValue(mockPending as any);
			jest.mocked(workspaceRepository.findById).mockResolvedValue(mockWorkspace);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);

			await workspaceController.getPendingInvitations(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
				success: true,
				data: expect.objectContaining({ count: 1 }),
			}));
		});
	});

	describe("updateInvitationStatus", () => {
		it("should accept invitation successfully", async () => {
			mockReq.params = { userWorkspaceId: "uw-1" };
			mockReq.body = { status: "accepted" };
			
			const mockPending = [{ userWorkspaceId: "uw-1", userId: "user-123" }];
			jest.mocked(userWorkspaceRepository.findPendingInvitations).mockResolvedValue(mockPending as any);
			jest.mocked(userWorkspaceRepository.updateInvitationStatus).mockResolvedValue({} as any);

			await workspaceController.updateInvitationStatus(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(userWorkspaceRepository.updateInvitationStatus).toHaveBeenCalledWith("uw-1", "accepted");
		});

		it("should throw NotFoundError if invitation not found", async () => {
			mockReq.params = { userWorkspaceId: "non-existent" };
			jest.mocked(userWorkspaceRepository.findPendingInvitations).mockResolvedValue([]);

			await workspaceController.updateInvitationStatus(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
		});
	});

	describe("removeMember", () => {
		it("should remove a member successfully", async () => {
			mockReq.params = { workspaceId: "workspace-123", userWorkspaceId: "uw-1" };
			mockReq.userId = "owner-id"; // Set current user as owner

			const mockMember = { userWorkspaceId: "uw-1", userId: "member-id", role: "editor" };
			jest.mocked(userWorkspaceRepository.findMembersByWorkspace).mockResolvedValue([mockMember] as any);
			jest.mocked(workspaceRepository.findById).mockResolvedValue({ ...mockWorkspace, ownerId: "owner-id" });
			jest.mocked(userWorkspaceRepository.delete).mockResolvedValue(undefined as any);

			await workspaceController.removeMember(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(204);
			expect(userWorkspaceRepository.delete).toHaveBeenCalledWith("uw-1");
		});

		it("should throw ForbiddenError if non-owner tries to remove another member", async () => {
			mockReq.params = { workspaceId: "workspace-123", userWorkspaceId: "uw-1" };
			mockReq.userId = "non-owner-id";

			const mockMember = { userWorkspaceId: "uw-1", userId: "member-id", role: "editor" };
			jest.mocked(userWorkspaceRepository.findMembersByWorkspace).mockResolvedValue([mockMember] as any);
			jest.mocked(workspaceRepository.findById).mockResolvedValue({ ...mockWorkspace, ownerId: "owner-id" });

			await workspaceController.removeMember(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});
	});
});
