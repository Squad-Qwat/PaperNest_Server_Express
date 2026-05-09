
export interface Document {
    documentId: string;
    workspaceId: string;
    title: string;
    description?: string;
    savedContent: any;
    currentVersionId: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}