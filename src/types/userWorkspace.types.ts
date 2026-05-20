export type WorkspaceRole = "owner" | "editor" | "viewer" | "reviewer";

export interface UserWorkspace {
	userWorkspaceId: string;
	userId: string;
	workspaceId: string;
	role: WorkspaceRole;
	invitationStatus: "pending" | "accepted" | "declined";
	invitedBy: string;
	createdAt: Date;
	updatedAt: Date;
}
