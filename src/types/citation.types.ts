export interface Citation {
	citationId: string;
	workspaceId: string;
	documentId?: string;
	type: "article" | "book" | "website" | string;
	title: string;
	author: string;
	publicationInfo: string;
	doi: string | null;
	accessDate: string;
	publicationDate: string;
	url: string | null;
	cslJson: Record<string, any>;
	createdAt: Date;
	updatedAt: Date;
}
