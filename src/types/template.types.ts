export interface TemplateMetadata {
	id: string;
	name: string;
	description: string;
	thumbnail?: string;
	mainFile: string;
	category: string;
}

export interface Template extends TemplateMetadata {
	content: string;
}
