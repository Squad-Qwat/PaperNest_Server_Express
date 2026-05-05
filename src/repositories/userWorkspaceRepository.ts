import { COLLECTIONS, INVITATION_STATUS } from "../config/constants";
import { db } from "../config/firebase";
import type { UserWorkspace } from "../types";

export class UserWorkspaceRepository {
	private collection = db.collection(COLLECTIONS.USER_WORKSPACES);

	/**
	 * Create user workspace relationship
	 */
	async create(
		data: Omit<UserWorkspace, "userWorkspaceId" | "createdAt" | "updatedAt">,
	): Promise<UserWorkspace> {
		const now = new Date();
		const docRef = this.collection.doc();

		const userWorkspace: UserWorkspace = {
			userWorkspaceId: docRef.id,
			...data,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(userWorkspace);
		return userWorkspace;
	}

	/**
	 * Find by user and workspace
	 */
	async findByUserAndWorkspace(
		userId: string,
		workspaceId: string,
	): Promise<UserWorkspace | null> {
		const snapshot = await this.collection
			.where("userId", "==", userId)
			.where("workspaceId", "==", workspaceId)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as UserWorkspace;
	}

	/**
	 * Find all workspaces for a user
	 */
	async findWorkspacesByUser(
		userId: string,
		status?: string,
	): Promise<UserWorkspace[]> {
		let query = this.collection.where("userId", "==", userId);

		if (status) {
			query = query.where("invitationStatus", "==", status);
		}

		const snapshot = await query.orderBy("updatedAt", "desc").get();

		return snapshot.docs.map((doc) => doc.data() as UserWorkspace);
	}

	/**
	 * Find all members of a workspace
	 */
	async findMembersByWorkspace(
		workspaceId: string,
		status?: string,
	): Promise<UserWorkspace[]> {
		let query = this.collection.where("workspaceId", "==", workspaceId);

		if (status) {
			query = query.where("invitationStatus", "==", status);
		}

		const snapshot = await query.get();

		return snapshot.docs.map((doc) => doc.data() as UserWorkspace);
	}

	/**
	 * Find pending invitations for a user
	 */
	async findPendingInvitations(userId: string): Promise<UserWorkspace[]> {
		const snapshot = await this.collection
			.where("userId", "==", userId)
			.where("invitationStatus", "==", INVITATION_STATUS.PENDING)
			.orderBy("createdAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as UserWorkspace);
	}

	/**
	 * Update user workspace relationship
	 */
	async update(
		userWorkspaceId: string,
		updates: Partial<Omit<UserWorkspace, "userWorkspaceId" | "createdAt">>,
	): Promise<UserWorkspace> {
		const updateData = {
			...updates,
			updatedAt: new Date(),
		};

		await this.collection.doc(userWorkspaceId).update(updateData);

		const doc = await this.collection.doc(userWorkspaceId).get();
		return doc.data() as UserWorkspace;
	}

	/**
	 * Update invitation status
	 */
	async updateInvitationStatus(
		userWorkspaceId: string,
		status: string,
	): Promise<UserWorkspace> {
		return this.update(userWorkspaceId, { invitationStatus: status as any });
	}

	/**
	 * Update member role
	 */
	async updateRole(
		userWorkspaceId: string,
		role: string,
	): Promise<UserWorkspace> {
		return this.update(userWorkspaceId, { role: role as any });
	}

	/**
	 * Delete user workspace relationship
	 */
	async delete(userWorkspaceId: string): Promise<void> {
		await this.collection.doc(userWorkspaceId).delete();
	}

	/**
	 * Delete by user and workspace
	 */
	async deleteByUserAndWorkspace(
		userId: string,
		workspaceId: string,
	): Promise<void> {
		const userWorkspace = await this.findByUserAndWorkspace(
			userId,
			workspaceId,
		);

		if (userWorkspace) {
			await this.delete(userWorkspace.userWorkspaceId);
		}
	}

	/**
	 * Check if user has access to workspace
	 */
	async hasAccess(userId: string, workspaceId: string): Promise<boolean> {
		const userWorkspace = await this.findByUserAndWorkspace(
			userId,
			workspaceId,
		);
		return (
			userWorkspace !== null &&
			userWorkspace.invitationStatus === INVITATION_STATUS.ACCEPTED
		);
	}

	/**
	 * Get user role in workspace
	 */
	async getUserRole(
		userId: string,
		workspaceId: string,
	): Promise<string | null> {
		const userWorkspace = await this.findByUserAndWorkspace(
			userId,
			workspaceId,
		);
		return userWorkspace?.role || null;
	}
}

export default new UserWorkspaceRepository();
