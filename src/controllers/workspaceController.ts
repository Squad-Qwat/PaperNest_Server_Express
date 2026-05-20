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
	BadRequestError,
} from "../utils/errorTypes";
import crypto from "crypto";
import invitationRepository from "../repositories/invitationRepository";
import { EmailService } from "../services/emailService";
import { env } from "../config/env";
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
				if (!workspace) return null; // Skips the orphaned record of a workspace
				return {
					...workspace,
					userRole: uw.role,
					userWorkspaceId: uw.userWorkspaceId,
				};
			}),
		);

		const validWorkspaces = workspaces.filter(Boolean); // Necessary filter for workspace

		return successResponse(
			res,
			{ workspaces: validWorkspaces, count: workspaces.length },
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

		// Cascade delete all UserWorkspace records first
		await userWorkspaceRepository.deleteByWorkspace(workspaceId as string);

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
 * Send email invitations to multiple users
 * POST /api/workspaces/:workspaceId/invitations
 * Protected (requires editor role or higher)
 */
export const sendInvitations = asyncHandler(
	async (req: Request, res: Response) => {
		const workspaceId = req.params.workspaceId as string;
		const { emails, role } = req.body;
		const inviterId = req.userId!;

		logger.info("Send invitations request", { workspaceId, emails, role });

		const workspace = await workspaceRepository.findById(workspaceId as string);
		if (!workspace) {
			throw new NotFoundError("Workspace not found");
		}

		const inviter = await userRepository.findById(inviterId);
		const results = [];

		for (const email of emails) {
			const user = await userRepository.findByEmail(email);
			if (user) {
				const existing = await userWorkspaceRepository.findByUserAndWorkspace(
					user.userId,
					workspaceId as string,
				);
				if (existing && existing.invitationStatus === "accepted") {
					continue;
				}
			}

			const token = crypto.randomBytes(32).toString("hex");
			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + 7);

			let invitation = await invitationRepository.findByEmailAndWorkspace(
				email,
				workspaceId as string,
			);

			if (invitation) {
				await invitationRepository.updateInvitation(invitation.invitationId, {
					token,
					status: "pending",
					expiresAt,
					updatedAt: new Date(),
				});
			} else {
				invitation = await invitationRepository.create({
					workspaceId: workspaceId as string,
					email,
					role: role || "viewer",
					inviterId,
					token,
					status: "pending",
					expiresAt,
				});
			}

			const inviteUrl = `${env.FRONTEND_URL}/invitations/accept/${token}`;
			await EmailService.sendWorkspaceInvitationEmail(
				email,
				inviter?.name || "Someone",
				workspace.title,
				inviteUrl,
			);

			if (user) {
				await notificationRepository.create({
					userId: user.userId,
					type: "invitation",
					title: "Undangan Workspace Baru",
					message: `${inviter?.name || "Seseorang"} mengundang Anda untuk bergabung ke workspace "${workspace.title}"`,
					relatedId: workspaceId as string,
					isRead: false,
				});
			}

			results.push({ email, status: "sent" });
		}

		return successResponse(
			res,
			{ results },
			"Invitations processed successfully",
		);
	},
);

/**
 * Get invitation details by token
 * GET /api/invitations/:token
 * Public (to show details before joining)
 */
export const getInvitationByToken = asyncHandler(
	async (req: Request, res: Response) => {
		const token = req.params.token as string;

		const invitation = await invitationRepository.findByToken(token);
		if (!invitation || invitation.status !== "pending") {
			throw new NotFoundError("Invitation not found or no longer valid");
		}

		const expiresAtVal = (invitation.expiresAt as any).toDate
			? (invitation.expiresAt as any).toDate()
			: new Date(invitation.expiresAt);

		if (expiresAtVal < new Date()) {
			await invitationRepository.updateStatus(
				invitation.invitationId,
				"expired",
			);
			throw new BadRequestError("Invitation has expired");
		}

		const workspace = await workspaceRepository.findById(invitation.workspaceId as string);
		const inviter = await userRepository.findById(invitation.inviterId);

		return successResponse(
			res,
			{
				invitation: {
					email: invitation.email,
					role: invitation.role,
					workspaceTitle: workspace?.title,
					workspaceIcon: workspace?.icon,
					inviterName: inviter?.name,
				},
			},
			"Invitation details retrieved successfully",
		);
	},
);

/**
 * Accept invitation
 * POST /api/invitations/:token/accept
 * Protected
 */
export const acceptInvitation = asyncHandler(
	async (req: Request, res: Response) => {
		const token = req.params.token as string;
		const userId = req.userId!;

		const invitation = await invitationRepository.findByToken(token);
		if (!invitation || invitation.status !== "pending") {
			throw new NotFoundError("Invitation not found or no longer valid");
		}

		const expiresAtVal = (invitation.expiresAt as any).toDate
			? (invitation.expiresAt as any).toDate()
			: new Date(invitation.expiresAt);

		if (expiresAtVal < new Date()) {
			await invitationRepository.updateStatus(
				invitation.invitationId,
				"expired",
			);
			throw new BadRequestError("Invitation has expired");
		}

		const user = await userRepository.findById(userId);
		if (user?.email !== invitation.email) {
			throw new ForbiddenError(
				"This invitation was sent to a different email address",
			);
		}

		const existing = await userWorkspaceRepository.findByUserAndWorkspace(
			userId,
			invitation.workspaceId as string,
		);

		if (existing) {
			if (existing.invitationStatus === "accepted") {
				await invitationRepository.updateStatus(
					invitation.invitationId,
					"accepted",
				);
				return successResponse(res, null, "You are already a member");
			}
			// Update existing pending status
			await userWorkspaceRepository.updateInvitationStatus(
				existing.userWorkspaceId,
				"accepted",
			);
		} else {
			// Create new member record
			await userWorkspaceRepository.create({
				userId,
				workspaceId: invitation.workspaceId,
				role: invitation.role,
				invitationStatus: "accepted",
				invitedBy: invitation.inviterId,
			});
		}

		await invitationRepository.updateStatus(invitation.invitationId, "accepted");

		return successResponse(res, null, "Successfully joined workspace");
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


export default {
	createWorkspace,
	getUserWorkspaces,
	getWorkspaceById,
	updateWorkspace,
	deleteWorkspace,
	getWorkspaceMembers,
	sendInvitations,
	getInvitationByToken,
	acceptInvitation,
	updateMemberRole,
	removeMember,
	getPendingInvitations,
	updateInvitationStatus,
};
