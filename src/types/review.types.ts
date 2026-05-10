export interface Review {
	reviewId: string;
	documentBodyId: string;
	documentId: string;
	lecturerUserId: string;
	studentUserId: string;
	message: string;
	status: "pending" | "approved" | "revision_required" | "rejected";
	requestedAt: Date;
	reviewedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}
