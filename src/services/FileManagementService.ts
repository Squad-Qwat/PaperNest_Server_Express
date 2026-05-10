import { db } from "../config/firebase";

export class FileManagementService {
	/**
	 * Updates a file name/path in Firestore
	 * @param documentId The document ID
	 * @param fileId The file document ID
	 * @param newName The new name (virtual path)
	 */
	static async updateFileName(documentId: string, fileId: string, newName: string) {
		const fileRef = db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.doc(fileId);

		const fileSnap = await fileRef.get();
		if (!fileSnap.exists) {
			throw new Error("File not found in database");
		}

		await fileRef.update({
			name: newName,
			updatedAt: new Date(),
		});

		return { success: true };
	}

	/**
	 * Deletes file metadata from Firestore
	 * @param documentId The document ID
	 * @param fileId The file document ID
	 */
	static async deleteFileMetadata(documentId: string, fileId: string) {
		const fileRef = db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.doc(fileId);

		const fileSnap = await fileRef.get();
		if (!fileSnap.exists) {
			throw new Error("File not found in database");
		}

		const data = fileSnap.data();
		await fileRef.delete();

		return { 
			success: true, 
			r2Key: data?.r2Key 
		};
	}

	/**
	 * Gets file metadata by ID
	 */
	static async getFileMetadata(documentId: string, fileId: string) {
		const fileRef = db
			.collection("documents")
			.doc(documentId)
			.collection("files")
			.doc(fileId);

		const fileSnap = await fileRef.get();
		if (!fileSnap.exists) {
			return null;
		}

		return { id: fileSnap.id, ...fileSnap.data() };
	}
}
