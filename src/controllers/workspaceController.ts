import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import notificationRepository from "../repositories/notificationRepository";
import userRepository from "../repositories/userRepository";
import userWorkspaceRepository from "../repositories/userWorkspaceRepository";
import workspaceRepository from "../repositories/workspaceRepository";
import {
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../utils/errorTypes";
import logger from "../utils/logger";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../utils/responseFormatter";

/**
 * Create a new workspace
 * POST /api/workspaces
 * Protected
 */
export const createWorkspace = asyncHandler(
	async (req: Request, res: Response) => {
		const { title, description, icon } = req.body;
		const userId = req.userId!;

		logger.info("Create workspace request", { userId, title });

		// Create workspace
		const workspace = await workspaceRepository.create({
			title,
			description: description || "",
			...(icon && { icon }),
			ownerId: userId,
		});

		// Add creator as owner in UserWorkspace
		await userWorkspaceRepository.create({
			userId,
			workspaceId: workspace.workspaceId,
			role: "owner",
			invitationStatus: "accepted",
			invitedBy: userId,
		});

		return createdResponse(
			res,
			{ workspace },
			"Workspace created successfully",
		);
	},
);

/**
 * Get all workspaces for current user
 * GET /api/workspaces
 * Protected
 */
export const getUserWorkspaces = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;

		logger.info("Get user workspaces request", { userId });

		const userWorkspaces = await userWorkspaceRepository.findWorkspacesByUser(
			userId,
			"accepted",
		);

		// Get full workspace details for each
		const workspaces = await Promise.all(
			userWorkspaces.map(async (uw) => {
				const workspace = await workspaceRepository.findById(uw.workspaceId);
				return {
					...workspace,
					userRole: uw.role,
					userWorkspaceId: uw.userWorkspaceId,
				};
			}),
		);

		return successResponse(
			res,
			{ workspaces, count: workspaces.length },
			"Workspaces retrieved successfully",
		);
	},
);

/**
 * Get workspace by ID
 * GET /api/workspaces/:workspaceId
 * Protected (requires workspace access)
 */
export const getWorkspaceById = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;
		const userId = req.userId!;

		logger.info("Get workspace request", { workspaceId, userId });

		const workspace = await workspaceRepository.findById(workspaceId as string);

		if (!workspace) {
			throw new NotFoundError("Workspace not found");
		}

		// Get user's role in workspace
		const userRole = await userWorkspaceRepository.getUserRole(
			userId,
			workspaceId as string,
		);

		return successResponse(
			res,
			{ workspace: { ...workspace, userRole } },
			"Workspace retrieved successfully",
		);
	},
);

/**
 * Update workspace
 * PUT /api/workspaces/:workspaceId
 * Protected (requires editor role or higher)
 */
export const updateWorkspace = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;
		const updates = req.body;

		logger.info("Update workspace request", { workspaceId, updates });

		const workspace = await workspaceRepository.update(
			workspaceId as string,
			updates,
		);

		return successResponse(
			res,
			{ workspace },
			"Workspace updated successfully",
		);
	},
);

/**
 * Delete workspace
 * DELETE /api/workspaces/:workspaceId
 * Protected (owner only)
 */
export const deleteWorkspace = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;

		logger.info("Delete workspace request", { workspaceId });

		// TODO: Implement cascade delete for documents, comments, etc.
		await workspaceRepository.delete(workspaceId as string);

		return noContentResponse(res);
	},
);

/**
 * Get workspace members
 * GET /api/workspaces/:workspaceId/members
 * Protected (requires workspace access)
 */
export const getWorkspaceMembers = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;

		logger.info("Get workspace members request", { workspaceId });

		const userWorkspaces = await userWorkspaceRepository.findMembersByWorkspace(
			workspaceId as string,
		);

		// Get full user details for each member
		const members = await Promise.all(
			userWorkspaces.map(async (uw) => {
				const user = await userRepository.findById(uw.userId);
				return {
					userWorkspaceId: uw.userWorkspaceId,
					user,
					role: uw.role,
					invitationStatus: uw.invitationStatus,
					invitedBy: uw.invitedBy,
					createdAt: uw.createdAt,
				};
			}),
		);

		return successResponse(
			res,
			{ members, count: members.length },
			"Members retrieved successfully",
		);
	},
);

/**
 * Invite member to workspace
 * POST /api/workspaces/:workspaceId/members
 * Protected (requires editor role or higher)
 */
export const inviteMember = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;
		const { userId, role } = req.body;
		const inviterId = req.userId!;

		logger.info("Invite member request", { workspaceId, userId, role });

		// Check if user exists
		const user = await userRepository.findById(userId);
		if (!user) {
			throw new NotFoundError("User not found");
		}

		// Check if already a member
		const existing = await userWorkspaceRepository.findByUserAndWorkspace(
			userId,
			workspaceId as string,
		);
		if (existing) {
			throw new ConflictError(
				"User is already a member or has pending invitation",
			);
		}

		// Create invitation
		const userWorkspace = await userWorkspaceRepository.create({
			userId,
			workspaceId: workspaceId as string,
			role: role || "viewer",
			invitationStatus: "pending",
			invitedBy: inviterId,
		});

		// Create notification for invited user
		const workspace = await workspaceRepository.findById(workspaceId as string);
		await notificationRepository.create({
			userId,
			type: "invitation",
			title: "Workspace Invitation",
			message: `You have been invited to join "${workspace?.title}"`,
			relatedId: userWorkspace.userWorkspaceId,
			isRead: false,
		});

		return createdResponse(
			res,
			{ userWorkspace },
			"Member invited successfully",
		);
	},
);

/**
 * Update member role
 * PUT /api/workspaces/:workspaceId/members/:userWorkspaceId
 * Protected (owner only)
 */
export const updateMemberRole = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId, userWorkspaceId } = req.params;
		const { role } = req.body;

		logger.info("Update member role request", {
			workspaceId,
			userWorkspaceId,
			role,
		});

		const userWorkspace = await userWorkspaceRepository.updateRole(
			userWorkspaceId as string,
			role,
		);

		return successResponse(
			res,
			{ userWorkspace },
			"Member role updated successfully",
		);
	},
);

/**
 * Remove member from workspace
 * DELETE /api/workspaces/:workspaceId/members/:userWorkspaceId
 * Protected (owner only, or user removing themselves)
 */
export const removeMember = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId, userWorkspaceId } = req.params;
		const userId = req.userId!;

		logger.info("Remove member request", { workspaceId, userWorkspaceId });

		// Find the actual userWorkspace by ID
		const allMembers = await userWorkspaceRepository.findMembersByWorkspace(
			workspaceId as string,
		);
		const userWorkspace = allMembers.find(
			(uw) => uw.userWorkspaceId === userWorkspaceId,
		);

		if (!userWorkspace) {
			throw new NotFoundError("Member not found");
		}

		// Check if user is removing themselves or is owner
		const workspace = await workspaceRepository.findById(workspaceId as string);
		const isSelf = userWorkspace.userId === userId;
		const isOwner = workspace?.ownerId === userId;

		if (!isSelf && !isOwner) {
			throw new ForbiddenError("Only owner can remove members");
		}

		// Cannot remove owner
		if (
			userWorkspace.role === "owner" &&
			userWorkspace.userId === workspace?.ownerId
		) {
			throw new ForbiddenError("Cannot remove workspace owner");
		}

		await userWorkspaceRepository.delete(userWorkspaceId as string);

		return noContentResponse(res);
	},
);

/**
 * Get pending invitations for current user
 * GET /api/invitations
 * Protected
 */
export const getPendingInvitations = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;

		logger.info("Get pending invitations request", { userId });

		const userWorkspaces =
			await userWorkspaceRepository.findPendingInvitations(userId);

		// Get full workspace details for each invitation
		const invitations = await Promise.all(
			userWorkspaces.map(async (uw) => {
				const workspace = await workspaceRepository.findById(uw.workspaceId);
				const inviter = await userRepository.findById(uw.invitedBy);
				return {
					userWorkspaceId: uw.userWorkspaceId,
					workspace,
					role: uw.role,
					invitedBy: inviter,
					createdAt: uw.createdAt,
				};
			}),
		);

		return successResponse(
			res,
			{ invitations, count: invitations.length },
			"Invitations retrieved successfully",
		);
	},
);

/**
 * Accept or decline invitation
 * PUT /api/invitations/:userWorkspaceId
 * Protected
 */
export const updateInvitationStatus = asyncHandler(
	async (req: Request, res: Response) => {
		const { userWorkspaceId } = req.params;
		const { status } = req.body;
		const userId = req.userId!;

		logger.info("Update invitation status request", {
			userWorkspaceId,
			status,
		});

		// Find pending invitations to locate the specific one
		const pendingInvitations =
			await userWorkspaceRepository.findPendingInvitations(userId);
		const userWorkspace = pendingInvitations.find(
			(uw) => uw.userWorkspaceId === userWorkspaceId,
		);

		if (!userWorkspace) {
			throw new NotFoundError("Invitation not found");
		}

		// Only the invited user can accept/decline
		if (userWorkspace.userId !== userId) {
			throw new ForbiddenError("You can only respond to your own invitations");
		}

		const updated = await userWorkspaceRepository.updateInvitationStatus(
			userWorkspaceId as string,
			status,
		);

		return successResponse(
			res,
			{ userWorkspace: updated },
			`Invitation ${status} successfully`,
		);
	},
);

/**
 * Join workspace directly
 * POST /api/workspaces/:workspaceId/join
 * Protected
 */
export const joinWorkspace = asyncHandler(
	async (req: Request, res: Response) => {
		const { workspaceId } = req.params;
		const userId = req.userId!;
		const { role } = req.body;

		logger.info("Join workspace request", { workspaceId, userId });

		const workspace = await workspaceRepository.findById(workspaceId as string);
		if (!workspace) {
			throw new NotFoundError("Workspace not found");
		}

		const existing = await userWorkspaceRepository.findByUserAndWorkspace(
			userId,
			workspaceId as string,
		);
		if (existing) {
			if (existing.invitationStatus === "accepted") {
				throw new ConflictError("You are already a member of this workspace");
			}
			if (existing.invitationStatus === "pending") {
				throw new ConflictError(
					"You have a pending invitation for this workspace",
				);
			}
		}

		const userWorkspace = await userWorkspaceRepository.create({
			userId,
			workspaceId: workspaceId as string,
			role: role || "viewer",
			invitationStatus: "accepted",
			invitedBy: userId,
		});

		return createdResponse(
			res,
			{ userWorkspace, workspace },
			"Successfully joined workspace",
		);
	},
);

export default {
	createWorkspace,
	getUserWorkspaces,
	getWorkspaceById,
	updateWorkspace,
	deleteWorkspace,
	getWorkspaceMembers,
	inviteMember,
	updateMemberRole,
	removeMember,
	getPendingInvitations,
	updateInvitationStatus,
	joinWorkspace,
};
