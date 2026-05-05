// Firestore Collection Names
export const COLLECTIONS = {
	USERS: "users",
	WORKSPACES: "workspaces",
	USER_WORKSPACES: "userWorkspaces",
	DOCUMENTS: "documents",
	DOCUMENT_BODIES: "documentBodies",
	CITATIONS: "citations",
	REVIEWS: "reviews",
	COMMENTS: "comments",
	NOTIFICATIONS: "notifications",
	PRESENCE: "presence",
	RAG_CHUNKS: "ragChunks",
} as const;

// User Roles
export const USER_ROLES = {
	STUDENT: "Student",
	LECTURER: "Lecturer",
} as const;

// Workspace Roles
export const WORKSPACE_ROLES = {
	OWNER: "owner",
	EDITOR: "editor",
	VIEWER: "viewer",
	REVIEWER: "reviewer",
} as const;

// Invitation Status
export const INVITATION_STATUS = {
	PENDING: "pending",
	ACCEPTED: "accepted",
	DECLINED: "declined",
} as const;

// Review Status
export const REVIEW_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	REVISION_REQUIRED: "revision_required",
	REJECTED: "rejected",
} as const;

// Notification Types
export const NOTIFICATION_TYPES = {
	INVITATION: "invitation",
	REVIEW_REQUEST: "review_request",
	REVIEW_COMPLETED: "review_completed",
	COMMENT: "comment",
	COMMENT_REPLY: "comment_reply",
	MENTION: "mention",
} as const;

// Citation Types
export const CITATION_TYPES = {
	ARTICLE: "article",
	BOOK: "book",
	WEBSITE: "website",
	JOURNAL: "journal",
	CONFERENCE: "conference",
	THESIS: "thesis",
	OTHER: "other",
} as const;

// Citation Formats
export const CITATION_FORMATS = {
	APA: "apa",
	IEEE: "ieee",
	MLA: "mla",
	CHICAGO: "chicago",
	HARVARD: "harvard",
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	INTERNAL_SERVER_ERROR: 500,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
	// Authentication
	INVALID_CREDENTIALS: "Invalid email or password",
	UNAUTHORIZED: "Unauthorized access",
	TOKEN_EXPIRED: "Token has expired",
	TOKEN_INVALID: "Invalid token",

	// User
	USER_NOT_FOUND: "User not found",
	USER_ALREADY_EXISTS: "User already exists",

	// Workspace
	WORKSPACE_NOT_FOUND: "Workspace not found",
	WORKSPACE_ACCESS_DENIED: "You do not have access to this workspace",
	INSUFFICIENT_PERMISSIONS: "Insufficient permissions",

	// Document
	DOCUMENT_NOT_FOUND: "Document not found",
	DOCUMENT_VERSION_NOT_FOUND: "Document version not found",

	// Citation
	CITATION_NOT_FOUND: "Citation not found",

	// Review
	REVIEW_NOT_FOUND: "Review not found",

	// Comment
	COMMENT_NOT_FOUND: "Comment not found",

	// General
	VALIDATION_ERROR: "Validation error",
	INTERNAL_ERROR: "Internal server error",
	RESOURCE_NOT_FOUND: "Resource not found",
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
	// Authentication
	LOGIN_SUCCESS: "Login successful",
	LOGOUT_SUCCESS: "Logout successful",
	REGISTER_SUCCESS: "Registration successful",

	// Workspace
	WORKSPACE_CREATED: "Workspace created successfully",
	WORKSPACE_UPDATED: "Workspace updated successfully",
	WORKSPACE_DELETED: "Workspace deleted successfully",

	// Document
	DOCUMENT_CREATED: "Document created successfully",
	DOCUMENT_UPDATED: "Document updated successfully",
	DOCUMENT_DELETED: "Document deleted successfully",
	VERSION_CREATED: "Version created successfully",
	VERSION_REVERTED: "Version reverted successfully",

	// Invitation
	INVITATION_SENT: "Invitation sent successfully",
	INVITATION_ACCEPTED: "Invitation accepted successfully",
	INVITATION_DECLINED: "Invitation declined successfully",

	// Review
	REVIEW_REQUESTED: "Review requested successfully",
	REVIEW_SUBMITTED: "Review submitted successfully",

	// Comment
	COMMENT_ADDED: "Comment added successfully",
	COMMENT_UPDATED: "Comment updated successfully",
	COMMENT_DELETED: "Comment deleted successfully",

	// Citation
	CITATION_ADDED: "Citation added successfully",
	CITATION_UPDATED: "Citation updated successfully",
	CITATION_DELETED: "Citation deleted successfully",
} as const;

// Pagination
export const PAGINATION = {
	DEFAULT_PAGE: 1,
	DEFAULT_LIMIT: 20,
	MAX_LIMIT: 100,
} as const;

// File Upload
export const FILE_UPLOAD = {
	MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
	ALLOWED_MIME_TYPES: [
		"image/jpeg",
		"image/png",
		"image/gif",
		"application/pdf",
	],
} as const;
