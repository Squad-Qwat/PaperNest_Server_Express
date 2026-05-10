export interface DocumentFile {
	fileId: string;
	name: string;
	type: string;
	url: string;
	r2Key: string;
	size?: number;
	createdAt: Date;
	updatedAt: Date;
}
