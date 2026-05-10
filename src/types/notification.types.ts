export interface Notification {
	notificationId: string;
	userId: string;
	type:
		| "invitation"
		| "review_request"
		| "review_completed"
		| "comment"
		| string;
	title: string;
	message: string;
	relatedId: string;
	isRead: boolean;
	createdAt: Date;
}
