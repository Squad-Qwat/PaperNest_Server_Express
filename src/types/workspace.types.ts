export interface Workspace {
    workspaceId: string;
    title: string;
    description: string;
    icon?: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
}