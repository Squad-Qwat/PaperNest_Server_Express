import { db } from "../config/firebase";
import type { DocumentFile } from "../types";

export class DocumentFileRepository {
	/**
	 * Add a file record to a document's files sub-collection
	 */
	async addFile(
		documentId: string,
		fileData: Omit<DocumentFile, "fileId" | "createdAt" | "updatedAt">,
	): Promise<DocumentFile> {
		const now = new Date();
		const fileRef = db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.doc();

		const documentFile: DocumentFile = {
			fileId: fileRef.id,
			...fileData,
			createdAt: now,
			updatedAt: now,
		};

		await fileRef.set(documentFile);
		return documentFile;
	}

	/**
	 * Get all files for a document
	 */
	async findByDocument(documentId: string): Promise<DocumentFile[]> {
		const snapshot = await db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.orderBy("createdAt", "desc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as DocumentFile);
	}

	/**
	 * Delete a file record
	 */
	async deleteFile(documentId: string, fileId: string): Promise<void> {
		await db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.doc(fileId)
			.delete();
	}

	/**
	 * Delete all file records for a document
	 */
	async deleteAllByDocument(documentId: string): Promise<void> {
		const snapshot = await db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.get();

		if (snapshot.empty) return;

		const batch = db.batch();
		snapshot.docs.forEach((doc) => {
			batch.delete(doc.ref);
		});

		await batch.commit();
	}
}

export default new DocumentFileRepository();
