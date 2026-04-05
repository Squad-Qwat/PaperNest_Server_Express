import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Workspace } from "../types";

export class WorkspaceRepository {
	private collection = db.collection(COLLECTIONS.WORKSPACES);

	/**
	 * Create a new workspace
	 */
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

	/**
	 * Find workspace by ID
	 */
	async findById(workspaceId: string): Promise<Workspace | null> {
		const doc = await this.collection.doc(workspaceId).get();

		if (!doc.exists) {
			return null;
		}

		return doc.data() as Workspace;
	}

	/**
	 * Find all workspaces by owner
	 */
	async findByOwner(ownerId: string): Promise<Workspace[]> {
		const snapshot = await this.collection
			.where("ownerId", "==", ownerId)
			.orderBy("updatedAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Workspace);
	}

	/**
	 * Update workspace
	 */
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

	/**
	 * Delete workspace
	 */
	async delete(workspaceId: string): Promise<void> {
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
