export interface UserWorkspace {
    userWorkspaceId: string;
    userId: string;
    workspaceId: string;
    role: "owner" | "editor" | "viewer" | "reviewer";
    invitationStatus: "pending" | "accepted" | "declined";
    invitedBy: string;
    createdAt: Date;
    updatedAt: Date;
}
