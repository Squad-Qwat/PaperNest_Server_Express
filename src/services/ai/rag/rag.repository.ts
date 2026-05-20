import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "../../../config/constants";
import { db } from "../../../config/firebase";
import type { PDFChunk } from "./pdf.extractor";

export interface StoredRAGChunk extends PDFChunk {
	workspaceId: string;
	documentId: string;
	fileKey: string;
	createdAt: Date;
}

export class RAGRepository {
	private collection = db.collection(COLLECTIONS.RAG_CHUNKS);

	async saveChunks(
		workspaceId: string,
		documentId: string,
		fileKey: string,
		chunks: PDFChunk[],
		embeddings: number[][],
	): Promise<void> {
		const batch = db.batch();
		const now = new Date();

		await this.deleteChunksByFile(documentId, fileKey);

		chunks.forEach((chunk, i) => {
			const docRef = this.collection.doc();
			const data = {
				...chunk,
				workspaceId,
				documentId,
				fileKey,
				embedding: FieldValue.vector(embeddings[i]),
				createdAt: now,
			};
			batch.set(docRef, data);
		});

		await batch.commit();
		console.log(`[RAGRepository] Saved ${chunks.length} chunks with vector embeddings`);
	}

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

	async searchVector(
		documentId: string,
		queryVector: number[],
		limit: number = 5,
	): Promise<StoredRAGChunk[]> {
		const vectorQuery = this.collection
			.where("documentId", "==", documentId)
			.findNearest({
				vectorField: "embedding",
				queryVector: FieldValue.vector(queryVector),
				limit,
				distanceMeasure: "COSINE",
			});

		const snapshot = await vectorQuery.get();
		return snapshot.docs.map((doc) => doc.data() as StoredRAGChunk);
	}

	async searchWorkspaceVector(
		workspaceId: string,
		queryVector: number[],
		limit: number = 5,
	): Promise<StoredRAGChunk[]> {
		const vectorQuery = this.collection
			.where("workspaceId", "==", workspaceId)
			.findNearest({
				vectorField: "embedding",
				queryVector: FieldValue.vector(queryVector),
				limit,
				distanceMeasure: "COSINE",
			});

		const snapshot = await vectorQuery.get();
		return snapshot.docs.map((doc) => doc.data() as StoredRAGChunk);
	}
}

export default new RAGRepository();
