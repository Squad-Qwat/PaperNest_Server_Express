import { COLLECTIONS } from "../config/constants";
import { db } from "../config/firebase";
import type { Comment } from "../types";

export class CommentRepository {
	private collection = db.collection(COLLECTIONS.COMMENTS);

	/**
	 * Create a new comment
	 */
	async create(
		commentData: Omit<Comment, "commentId" | "createdAt" | "updatedAt">,
	): Promise<Comment> {
		const now = new Date();
		const docRef = this.collection.doc();

		const comment: Comment = {
			commentId: docRef.id,
			...commentData,
			createdAt: now,
			updatedAt: now,
		};

		await docRef.set(comment);
		return comment;
	}

	/**
	 * Find comment by ID
	 */
	async findById(commentId: string): Promise<Comment | null> {
		const doc = await this.collection.doc(commentId).get();

		if (!doc.exists) {
			return null;
		}

		return doc.data() as Comment;
	}

	/**
	 * Find all comments for a document
	 */
	async findByDocument(documentId: string): Promise<Comment[]> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.orderBy("createdAt", "asc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Comment);
	}

	/**
	 * Find top-level comments (no parent)
	 */
	async findTopLevelComments(documentId: string): Promise<Comment[]> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("parentCommentId", "==", null)
			.orderBy("createdAt", "asc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Comment);
	}

	/**
	 * Find replies to a comment
	 */
	async findReplies(parentCommentId: string): Promise<Comment[]> {
		const snapshot = await this.collection
			.where("parentCommentId", "==", parentCommentId)
			.orderBy("createdAt", "asc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Comment);
	}

	/**
	 * Find comments by user
	 */
	async findByUser(userId: string, documentId?: string): Promise<Comment[]> {
		let query = this.collection.where("userId", "==", userId);

		if (documentId) {
			query = query.where("documentId", "==", documentId);
		}

		const snapshot = await query.orderBy("createdAt", "desc").get();

		return snapshot.docs.map((doc) => doc.data() as Comment);
	}

	/**
	 * Find unresolved comments
	 */
	async findUnresolved(documentId: string): Promise<Comment[]> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("isResolved", "==", false)
			.orderBy("createdAt", "asc")
			.get();

		return snapshot.docs.map((doc) => doc.data() as Comment);
	}

	/**
	 * Update comment
	 */
	async update(
		commentId: string,
		updates: Partial<Omit<Comment, "commentId" | "createdAt">>,
	): Promise<Comment> {
		const updateData = {
			...updates,
			updatedAt: new Date(),
		};

		await this.collection.doc(commentId).update(updateData);

		const updated = await this.findById(commentId);
		if (!updated) {
			throw new Error("Comment not found after update");
		}

		return updated;
	}

	/**
	 * Mark comment as resolved
	 */
	async markAsResolved(commentId: string): Promise<Comment> {
		return this.update(commentId, { isResolved: true });
	}

	/**
	 * Mark comment as unresolved
	 */
	async markAsUnresolved(commentId: string): Promise<Comment> {
		return this.update(commentId, { isResolved: false });
	}

	/**
	 * Delete comment
	 */
	async delete(commentId: string): Promise<void> {
		await this.collection.doc(commentId).delete();
	}

	/**
	 * Delete comment and all its replies
	 */
	async deleteWithReplies(commentId: string): Promise<void> {
		const replies = await this.findReplies(commentId);

		const batch = db.batch();

		// Delete the comment
		batch.delete(this.collection.doc(commentId));

		// Delete all replies
		replies.forEach((reply) => {
			batch.delete(this.collection.doc(reply.commentId));
		});

		await batch.commit();
	}

	/**
	 * Delete all comments for a document
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
	 * Count comments in a document
	 */
	async countByDocument(documentId: string): Promise<number> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.count()
			.get();

		return snapshot.data().count;
	}

	/**
	 * Count unresolved comments
	 */
	async countUnresolved(documentId: string): Promise<number> {
		const snapshot = await this.collection
			.where("documentId", "==", documentId)
			.where("isResolved", "==", false)
			.count()
			.get();

		return snapshot.data().count;
	}

	/**
	 * Check if comment exists
	 */
	async exists(commentId: string): Promise<boolean> {
		const doc = await this.collection.doc(commentId).get();
		return doc.exists;
	}
}

export default new CommentRepository();
