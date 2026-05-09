export interface SemanticScholarPaper {
	paperId: string;
	externalIds?: Record<string, string>;
	url?: string;
	title?: string;
	abstract?: string;
	venue?: string;
	year?: number;
	citationCount?: number;
	openAccessPdf?: {
		url: string;
		status: string;
	};
	authors?: Array<{
		authorId: string;
		name: string;
	}>;
	fieldsOfStudy?: string[];
}
