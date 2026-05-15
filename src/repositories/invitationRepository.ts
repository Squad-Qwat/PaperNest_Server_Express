import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Invitation } from "../types";

export class InvitationRepository {
	private collection = db.collection(COLLECTIONS.INVITATIONS);

	async create(
		data: Omit<Invitation, "invitationId" | "createdAt" | "updatedAt">,
	): Promise<Invitation> {
		const now = new Date();
		const docRef = this.collection.doc();

		const invitation: Invitation = {
			invitationId: docRef.id,
			...data,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(invitation);
		return invitation;
	}

	async findByToken(token: string): Promise<Invitation | null> {
		const snapshot = await this.collection
			.where("token", "==", token)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as Invitation;
	}

	async findByEmailAndWorkspace(
		email: string,
		workspaceId: string,
	): Promise<Invitation | null> {
		const snapshot = await this.collection
			.where("email", "==", email)
			.where("workspaceId", "==", workspaceId)
			.where("status", "==", "pending")
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as Invitation;
	}

	async updateStatus(
		invitationId: string,
		status: Invitation["status"],
	): Promise<void> {
		await this.collection.doc(invitationId).update({
			status,
			updatedAt: new Date(),
		});
	}

	async updateInvitation(
		invitationId: string,
		updates: Partial<Omit<Invitation, "invitationId" | "createdAt">>,
	): Promise<void> {
		await this.collection.doc(invitationId).update({
			...updates,
			updatedAt: new Date(),
		});
	}

	async findPendingByEmail(email: string): Promise<Invitation[]> {
		const snapshot = await this.collection
			.where("email", "==", email)
			.where("status", "==", "pending")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Invitation);
	}
}

export default new InvitationRepository();
