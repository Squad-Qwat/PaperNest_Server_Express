import type { WorkspaceRole } from "./userWorkspace.types";

export interface Invitation {
	invitationId: string;
	workspaceId: string;
	email: string;
	role: WorkspaceRole;
	inviterId: string;
	token: string;
	status: "pending" | "accepted" | "expired" | "declined";
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}
