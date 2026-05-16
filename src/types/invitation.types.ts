import type { WorkspaceRole } from "./userWorkspace.types";

export interface Invitation {
	invitationId: string;
	workspaceId: string;
	email: string;
	role: Exclude<WorkspaceRole, "owner">;
	inviterId: string;
	token: string;
	status: "pending" | "accepted" | "expired" | "declined";
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
}
