import { COLLECTIONS } from "../../../config/constants";
import { db } from "../../../config/firebase";
import type { PDFChunk } from "./pdf.extractor";

export interface StoredRAGChunk extends PDFChunk {
	documentId: string;
	fileKey: string;
	createdAt: Date;
}

/**
 * Repository for RAG Chunks stored in Firestore
 */
export class RAGRepository {
	private collection = db.collection(COLLECTIONS.RAG_CHUNKS);

	/**
	 * Batch save chunks for a document
	 */
	async saveChunks(
		documentId: string,
		fileKey: string,
		chunks: PDFChunk[],
	): Promise<void> {
		const batch = db.batch();
		const now = new Date();

		// Optionally: Delete old chunks for this fileKey first to avoid duplicates
		await this.deleteChunksByFile(documentId, fileKey);

		chunks.forEach((chunk) => {
			const docRef = this.collection.doc();
			const data: StoredRAGChunk = {
				...chunk,
				documentId,
				fileKey,
				createdAt: now,
			};
			batch.set(docRef, data);
		});

		await batch.commit();
		console.log(
			`[RAGRepository] Saved ${chunks.length} chunks for document ${documentId}`,
		);
	}

	/**
	 * Delete chunks for a specific file
	 */
	async deleteChunksByFile(documentId: string, fileKey: string): Promise<void> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("fileKey", "==", fileKey)
			.get();

		if (snapshot.empty) return;

		const batch = db.batch();
		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});
		await batch.commit();
		console.log(`[RAGRepository] Deleted existing chunks for file ${fileKey}`);
	}

	/**
	 * Search chunks for a document
	 * Note: Simple keyword search for now as we don't have a vector index set up yet.
	 * In a real system, this would use a vector database query.
	 */
	async search(
		documentId: string,
		query: string,
		limit: number = 5,
	): Promise<StoredRAGChunk[]> {
		// Simple case-insensitive contains search is not natively supported by Firestore
		// We will fetch more chunks and filter in memory for now,
		// or just fetch most recent if no advanced search is available.
		// For a true RAG, we would use embeddings.

		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.limit(100) // Fetch a reasonable subset to search in-memory
			.get();

		const searchTerms = query.toLowerCase().split(/\s+/);
		const results = snapshot.docs
			.map((doc) => doc.data() as StoredRAGChunk)
			.filter((chunk) => {
				const text = chunk.text.toLowerCase();
				return searchTerms.some((term) => text.includes(term));
			})
			// Sort by "relevance" (count of search terms matched)
			.sort((a, b) => {
				const aMatches = searchTerms.filter((t) =>
					a.text.toLowerCase().includes(t),
				).length;
				const bMatches = searchTerms.filter((t) =>
					b.text.toLowerCase().includes(t),
				).length;
				return bMatches - aMatches;
			})
			.slice(0, limit);

		return results;
	}
}

export default new RAGRepository();
