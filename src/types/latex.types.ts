export interface LatexCompileOptions {
	content: string;
	mainFileName?: string;
	assets?: Array<{ name: string; url: string; r2Key?: string }>;
	engine?: "tectonic" | "pdflatex";
}

export interface LatexCompileResult {
	pdf?: Buffer;
	log: string;
	status: number;
}
