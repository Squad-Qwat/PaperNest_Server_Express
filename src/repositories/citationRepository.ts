import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Citation } from "../types";

export class CitationRepository {
	private collection = db.collection(COLLECTIONS.CITATIONS);

	/**
	 * Create a new citation
	 */
	async create(
		citationData: Omit<Citation, "citationId" | "createdAt" | "updatedAt">,
	): Promise<Citation> {
		const now = new Date();
		const docRef = this.collection.doc();

		const citation: Citation = {
			citationId: docRef.id,
			...citationData,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(citation);
		return citation;
	}

	/**
	 * Find citation by ID
	 */
	async findById(citationId: string): Promise<Citation | null> {
		const doc = await this.collection.doc(citationId).get();

		if (!doc.exists) {
			return null;
		}

		return doc.data() as Citation;
	}

	/**
	 * Find all citations for a document
	 */
	async findByDocument(documentId: string): Promise<Citation[]> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.orderBy("createdAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Citation);
	}

	/**
	 * Find citations by type
	 */
	async findByType(documentId: string, type: string): Promise<Citation[]> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("type", "==", type)
			.orderBy("createdAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Citation);
	}

	/**
	 * Find citation by DOI
	 */
	async findByDoi(documentId: string, doi: string): Promise<Citation | null> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("doi", "==", doi)
			.limit(1)
			.get();

		if (snapshot.empty) {
			return null;
		}

		return snapshot.docs[0].data() as Citation;
	}

	/**
	 * Search citations by title or author
	 */
	async search(
		documentId: string,
		searchTerm: string,
		limit: number = 10,
	): Promise<Citation[]> {
		const lowerSearch = searchTerm.toLowerCase();

		// Search by title
		const titleSnapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("title", ">=", lowerSearch)
			.where("title", "<=", lowerSearch + "\uf8ff")
			.limit(limit)
			.get();

		// Search by author
		const authorSnapshot = await this.collection
			.where("documentId", "==", documentId)
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
	 * Update citation
	 */
	async update(
		citationId: string,
		updates: Partial<Omit<Citation, "citationId" | "createdAt">>,
	): Promise<Citation> {
		const updateData = {
			...updates,
			updatedAt: new Date(),
		};

		await this.collection.doc(citationId).update(updateData);

		const updated = await this.findById(citationId);
		if (!updated) {
			throw new Error("Citation not found after update");
		}

		return updated;
	}

	/**
	 * Delete citation
	 */
	async delete(citationId: string): Promise<void> {
		await this.collection.doc(citationId).delete();
	}

	/**
	 * Delete all citations for a document
	 */
	async deleteAllByDocument(documentId: string): Promise<void> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.get();

		const batch = db.batch();

		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});

		await batch.commit();
	}

	/**
	 * Count citations in a document
	 */
	async countByDocument(documentId: string): Promise<number> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.count()
			.get();

		return snapshot.data().count;
	}

	/**
	 * Check if citation exists
	 */
	async exists(citationId: string): Promise<boolean> {
		const doc = await this.collection.doc(citationId).get();
		return doc.exists;
	}
}

export default new CitationRepository();
