export interface Comment {
	commentId: string;
	documentId: string;
	userId: string;
	content: string;
	textSelection: {
		start: number;
		end: number;
		text: string;
	} | null;
	parentCommentId: string | null;
	isResolved: boolean;
	createdAt: Date;
	updatedAt: Date;
}
