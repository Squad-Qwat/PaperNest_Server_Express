

export interface DocumentBody {
    documentBodyId: string;
    documentId: string;
    userId: string;
    content: any;
    message: string;
    isCurrentVersion: boolean;
    versionNumber: number;
    createdAt: Date;
    updatedAt: Date;
}
