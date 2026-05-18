import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Citation } from "../types";

export class CitationRepository {
	private collection = db.collection(COLLECTIONS.CITATIONS);

	/**
	 * Create a new global citation for a user
	 */
	async createGlobalCitation(
		userId: string,
		citationData: Omit<Citation, "citationId" | "userId" | "createdAt" | "updatedAt">,
	): Promise<Citation> {
		const now = new Date();
		const docRef = this.collection.doc();

		const citation: Citation = {
			citationId: docRef.id,
			userId,
			...citationData,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(citation);
		return citation;
	}

	/**
	 * Find all citations owned by a user
	 */
	async findCitationsByUser(userId: string): Promise<Citation[]> {
		const snapshot = await this.collection
			.where("userId", "==", userId)
			.orderBy("createdAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Citation);
	}

	/**
	 * Get all citations for a user with pagination
	 */
	async getAllByPagination(
		userId: string,
		page: number = 1,
		limit: number = 10,
	): Promise<{ data: Citation[]; total: number; totalPages: number }> {
		const offset = (page - 1) * limit;

		const countSnapshot = await this.collection
			.where("userId", "==", userId)
			.count()
			.get();
		
		const total = countSnapshot.data().count;
		const totalPages = Math.ceil(total / limit);

		const snapshot = await this.collection
			.where("userId", "==", userId)
			.orderBy("createdAt", "desc")
			.offset(offset)
			.limit(limit)
			.get();

		const data = snapshot.docs.map((doc) => doc.data() as Citation);

		return {
			data,
			total,
			totalPages,
		};
	}

	/**
	 * Find specific citation by ID ensuring ownership
	 */
	async findUserCitationById(userId: string, citationId: string): Promise<Citation | null> {
		const doc = await this.collection.doc(citationId).get();

		if (!doc.exists) {
			return null;
		}

		const data = doc.data() as Citation;
		if (data.userId !== userId) {
			return null;
		}

		return data;
	}

	/**
	 * Find citation by exact name/title for a user
	 */
	async findByName(userId: string, titleName: string): Promise<Citation | null> {
		const snapshot = await this.collection
			.where("userId", "==", userId)
			.where("title", "==", titleName)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as Citation;
	}

	/**
	 * Update user's citation
	 */
	async updateUserCitation(
		userId: string,
		citationId: string,
		updates: Partial<Omit<Citation, "citationId" | "userId" | "createdAt">>,
	): Promise<Citation> {
		// Verify ownership first
		const existing = await this.findUserCitationById(userId, citationId);
		if (!existing) {
			throw new Error("Citation not found or unauthorized");
		}

		const updateData = {
			...updates,
			updatedAt: new Date(),
		};

		await this.collection.doc(citationId).update(updateData);

		const updated = await this.findUserCitationById(userId, citationId);
		if (!updated) {
			throw new Error("Citation not found after update");
		}

		return updated;
	}

	/**
	 * Delete user's citation
	 */
	async deleteUserCitation(userId: string, citationId: string): Promise<boolean> {
		// Verify ownership first
		const existing = await this.findUserCitationById(userId, citationId);
		if (!existing) {
			return false;
		}

		await this.collection.doc(citationId).delete();
		return true;
	}

	/**
	 * Search citations by user (title or author)
	 */
	async searchCitationsByUser(
		userId: string,
		searchTerm: string,
		limit: number = 10,
	): Promise<Citation[]> {
		const lowerSearch = searchTerm.toLowerCase();

		// Note: Firestore doesn't support complex text search efficiently natively, 
		// but using range queries for prefix matches.
		const titleSnapshot = await this.collection
			.where("userId", "==", userId)
			.where("title", ">=", lowerSearch)
			.where("title", "<=", lowerSearch + "\uf8ff")
			.limit(limit)
			.get();

		const authorSnapshot = await this.collection
			.where("userId", "==", userId)
			.where("author", ">=", lowerSearch)
			.where("author", "<=", lowerSearch + "\uf8ff")
			.limit(limit)
			.get();

		const citations = new Map<string, Citation>();

		titleSnapshot.docs.forEach((doc) => {
			citations.set(doc.id, doc.data() as Citation);
		});

		authorSnapshot.docs.forEach((doc) => {
			citations.set(doc.id, doc.data() as Citation);
		});

		return Array.from(citations.values()).slice(0, limit);
	}

	/**
	 * Find user's citation by DOI
	 */
	async findUserCitationByDoi(userId: string, doi: string): Promise<Citation | null> {
		const snapshot = await this.collection
			.where("userId", "==", userId)
			.where("doi", "==", doi)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as Citation;
	}
}

export default new CitationRepository();
