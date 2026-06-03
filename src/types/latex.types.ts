export interface LatexCompileOptions {
	content: string;
	mainFileName?: string;
	assets?: Array<{ name: string; url: string; r2Key?: string }>;
	engine?: "tectonic" | "pdflatex";
	documentId?: string;
}

export interface LatexCompileResult {
	pdf?: Buffer;
	log: string;
	status: number;
}
