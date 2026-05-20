import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Workspace } from "../types";
import { StorageService } from "../services/StorageService";
import liveblocksWebhookService from "../services/liveblocksWebhookService";

export class WorkspaceRepository {
	private collection = db.collection(COLLECTIONS.WORKSPACES);

	async create(
		workspaceData: Omit<Workspace, "workspaceId" | "createdAt" | "updatedAt">,
	): Promise<Workspace> {
		const now = new Date();
		const docRef = this.collection.doc();

		const workspace: Workspace = {
			workspaceId: docRef.id,
			...workspaceData,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(workspace);
		return workspace;
	}

	async findById(workspaceId: string): Promise<Workspace | null> {
		const doc = await this.collection.doc(workspaceId).get();

		if (!doc.exists) {
			return null;
		}

		return doc.data() as Workspace;
	}

	async findByOwner(ownerId: string): Promise<Workspace[]> {
		const snapshot = await this.collection
			.where("ownerId", "==", ownerId)
			.orderBy("updatedAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Workspace);
	}

	async update(
		workspaceId: string,
		updates: Partial<Omit<Workspace, "workspaceId" | "createdAt">>,
	): Promise<Workspace> {
		const updateData = {
			...updates,
			updatedAt: new Date(),
		};

		await this.collection.doc(workspaceId).update(updateData);

		const updated = await this.findById(workspaceId);
		if (!updated) {
			throw new Error("Workspace not found after update");
		}

		return updated;
	}

	async delete(workspaceId: string): Promise<void> {
		const docSnap = await db.collection(COLLECTIONS.DOCUMENTS).where("workspaceId", "==", workspaceId).get();
		await Promise.all(docSnap.docs.map(async (doc) => {
			try {
				await StorageService.deleteFilesByPrefix(`latex-assets/${doc.id}/`);
			} catch {}
			const batch1 = db.batch();
			const queries = [
				db.collection(COLLECTIONS.DOCUMENT_BODIES).where("documentId", "==", doc.id),
				db.collection(COLLECTIONS.CITATIONS).where("documentId", "==", doc.id),
				db.collection(COLLECTIONS.COMMENTS).where("documentId", "==", doc.id),
				db.collection(COLLECTIONS.REVIEWS).where("documentId", "==", doc.id),
				db.collection("documentPermissions").where("documentId", "==", doc.id),
				db.collection(COLLECTIONS.RAG_CHUNKS).where("documentId", "==", doc.id),
			];
			const snaps = await Promise.all(queries.map((q) => q.get()));
			for (const snap of snaps) {
				snap.docs.forEach((d) => batch1.delete(d.ref));
			}
			const filesSnap = await db.collection(COLLECTIONS.DOCUMENTS).doc(doc.id).collection("files").get();
			filesSnap.docs.forEach((d) => batch1.delete(d.ref));
			await batch1.commit();
			await db.collection(COLLECTIONS.DOCUMENTS).doc(doc.id).delete();
			try {
				await liveblocksWebhookService.deleteRoom(`document:${doc.id}`);
			} catch {}
		}));

		const batch = db.batch();
		const queries = [
			db.collection(COLLECTIONS.USER_WORKSPACES).where("workspaceId", "==", workspaceId),
			db.collection(COLLECTIONS.INVITATIONS).where("workspaceId", "==", workspaceId),
			db.collection(COLLECTIONS.RAG_CHUNKS).where("workspaceId", "==", workspaceId),
		];
		const snaps = await Promise.all(queries.map((q) => q.get()));
		for (const snap of snaps) {
			snap.docs.forEach((d) => batch.delete(d.ref));
		}
		await batch.commit();
		await this.collection.doc(workspaceId).delete();
	}

	/**
	 * Check if workspace exists
	 */
	async exists(workspaceId: string): Promise<boolean> {
		const doc = await this.collection.doc(workspaceId).get();
		return doc.exists;
	}

	/**
	 * Get workspace count by owner
	 */
	async countByOwner(ownerId: string): Promise<number> {
		const snapshot = await this.collection
			.where("ownerId", "==", ownerId)
			.count()
			.get();

		return snapshot.data().count;
	}
}

export default new WorkspaceRepository();
