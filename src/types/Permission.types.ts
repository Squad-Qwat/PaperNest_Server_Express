/**
 * Document Permission Types
 * Defines granular permission levels for document access control
 */

export type DocumentPermission = "viewer" | "editor" | "admin";

export interface DocumentPermissionRecord {
	documentPermissionId: string;
	userId: string;
	documentId: string;
	permission: DocumentPermission;
	grantedBy: string; // User ID who granted this permission
	grantedAt: any; // Firebase Timestamp
	updatedAt: any;
}

export interface PermissionCheckResult {
	hasAccess: boolean;
	permission: DocumentPermission | null;
	source: "direct" | "workspace-inherited";
}

/**
 * Permission level hierarchy (for authorization checks)
 * Higher number = more permissions
 */
export const PERMISSION_HIERARCHY: Record<DocumentPermission, number> = {
	viewer: 1,
	editor: 2,
	admin: 3,
};

/**
 * Permission action mapping
 * Defines which permission levels can perform which actions
 */
export const PERMISSION_ACTIONS: Record<DocumentPermission, string[]> = {
	viewer: ["read", "read-versions"],
	editor: [
		"read",
		"write",
		"read-versions",
		"create-version",
		"read-comments",
		"write-comments",
	],
	admin: [
		"read",
		"write",
		"read-versions",
		"create-version",
		"delete",
		"manage-permissions",
		"read-comments",
		"write-comments",
	],
};
