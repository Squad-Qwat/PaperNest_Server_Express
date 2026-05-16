import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import workspaceController from "../../controllers/workspaceController";
import invitationRepository from "../../repositories/invitationRepository";
import notificationRepository from "../../repositories/notificationRepository";
import userRepository from "../../repositories/userRepository";
import userWorkspaceRepository from "../../repositories/userWorkspaceRepository";
import workspaceRepository from "../../repositories/workspaceRepository";
import { EmailService } from "../../services/emailService";
import { mockUser, mockWorkspace } from "../../tests/fixtures";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
}));
jest.mock("../../repositories/workspaceRepository");
jest.mock("../../repositories/userWorkspaceRepository");
jest.mock("../../repositories/userRepository");
jest.mock("../../repositories/notificationRepository");
jest.mock("../../repositories/invitationRepository");
jest.mock("../../services/emailService");
jest.mock("../../utils/logger");

import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../utils/errorTypes";

import { createMockExpress } from "../testUtils";

describe("WorkspaceController", () => {
	let mockReq: any;
	let mockRes: any;
	let next: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		const mocks = createMockExpress();
		mockReq = mocks.mockReq;
		mockRes = mocks.mockRes;
		next = mocks.next;
	});

	describe("createWorkspace", () => {
		it("should create a workspace and add owner successfully", async () => {
			mockReq.body = { title: "New Workspace" };
			jest.mocked(workspaceRepository.create).mockResolvedValue(mockWorkspace);
			jest.mocked(userWorkspaceRepository.create).mockResolvedValue({} as any);

			await workspaceController.createWorkspace(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(201);
			expect(workspaceRepository.create).toHaveBeenCalled();
			expect(userWorkspaceRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					role: "owner",
					invitationStatus: "accepted",
				}),
			);
		});
	});

	describe("sendInvitations", () => {
		it("should send invitations and create invitation records", async () => {
			mockReq.params = { workspaceId: "workspace-123" };
			mockReq.body = { emails: ["invited@example.com"], role: "editor" };
			mockReq.userId = "owner-id";

			jest.mocked(workspaceRepository.findById).mockResolvedValue(mockWorkspace);
			jest.mocked(userRepository.findById).mockResolvedValue({ name: "Owner" } as any);
			jest.mocked(userRepository.findByEmail).mockResolvedValue(null);
			jest.mocked(invitationRepository.findByEmailAndWorkspace).mockResolvedValue(null);
			jest.mocked(invitationRepository.create).mockResolvedValue({} as any);
			jest.mocked(EmailService.sendWorkspaceInvitationEmail).mockResolvedValue(undefined as any);

			await workspaceController.sendInvitations(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(invitationRepository.create).toHaveBeenCalled();
			expect(EmailService.sendWorkspaceInvitationEmail).toHaveBeenCalled();
		});

		it("should throw NotFoundError if workspace not found", async () => {
			mockReq.params = { workspaceId: "non-existent" };
			mockReq.body = { emails: ["test@example.com"] };
			jest.mocked(workspaceRepository.findById).mockResolvedValue(null);

			await workspaceController.sendInvitations(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
		});
	});

	describe("getPendingInvitations", () => {
		it("should return pending invitations for user", async () => {
			const mockPending = [
				{
					workspaceId: "workspace-123",
					invitedBy: "admin",
					userWorkspaceId: "uw-1",
				},
			];
			jest
				.mocked(userWorkspaceRepository.findPendingInvitations)
				.mockResolvedValue(mockPending as any);
			jest
				.mocked(workspaceRepository.findById)
				.mockResolvedValue(mockWorkspace);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);

			await workspaceController.getPendingInvitations(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(mockRes.json).toHaveBeenCalledWith(
				expect.objectContaining({
					success: true,
					data: expect.objectContaining({ count: 1 }),
				}),
			);
		});
	});

	describe("updateInvitationStatus", () => {
		it("should accept invitation successfully", async () => {
			mockReq.params = { userWorkspaceId: "uw-1" };
			mockReq.body = { status: "accepted" };

			const mockPending = [{ userWorkspaceId: "uw-1", userId: "user-123" }];
			jest
				.mocked(userWorkspaceRepository.findPendingInvitations)
				.mockResolvedValue(mockPending as any);
			jest
				.mocked(userWorkspaceRepository.updateInvitationStatus)
				.mockResolvedValue({} as any);

			await workspaceController.updateInvitationStatus(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(200);
			expect(
				userWorkspaceRepository.updateInvitationStatus,
			).toHaveBeenCalledWith("uw-1", "accepted");
		});

		it("should throw NotFoundError if invitation not found", async () => {
			mockReq.params = { userWorkspaceId: "non-existent" };
			jest
				.mocked(userWorkspaceRepository.findPendingInvitations)
				.mockResolvedValue([]);

			await workspaceController.updateInvitationStatus(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
		});
	});

	describe("removeMember", () => {
		it("should remove a member successfully", async () => {
			mockReq.params = {
				workspaceId: "workspace-123",
				userWorkspaceId: "uw-1",
			};
			mockReq.userId = "owner-id"; // Set current user as owner

			const mockMember = {
				userWorkspaceId: "uw-1",
				userId: "member-id",
				role: "editor",
			};
			jest
				.mocked(userWorkspaceRepository.findMembersByWorkspace)
				.mockResolvedValue([mockMember] as any);
			jest
				.mocked(workspaceRepository.findById)
				.mockResolvedValue({ ...mockWorkspace, ownerId: "owner-id" });
			jest
				.mocked(userWorkspaceRepository.delete)
				.mockResolvedValue(undefined as any);

			await workspaceController.removeMember(mockReq, mockRes, next);

			expect(mockRes.status).toHaveBeenCalledWith(204);
			expect(userWorkspaceRepository.delete).toHaveBeenCalledWith("uw-1");
		});

		it("should throw ForbiddenError if non-owner tries to remove another member", async () => {
			mockReq.params = {
				workspaceId: "workspace-123",
				userWorkspaceId: "uw-1",
			};
			mockReq.userId = "non-owner-id";

			const mockMember = {
				userWorkspaceId: "uw-1",
				userId: "member-id",
				role: "editor",
			};
			jest
				.mocked(userWorkspaceRepository.findMembersByWorkspace)
				.mockResolvedValue([mockMember] as any);
			jest
				.mocked(workspaceRepository.findById)
				.mockResolvedValue({ ...mockWorkspace, ownerId: "owner-id" });

			await workspaceController.removeMember(mockReq, mockRes, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});
	});
});
