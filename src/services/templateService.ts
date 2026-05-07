import fs from "fs/promises";
import path from "path";
import type { TemplateMetadata } from "../types";
import logger from "../utils/logger";

export class TemplateService {
	private templatesDir = path.join(__dirname, "..", "templates", "files");

	/**
	 * Lists all available templates by scanning the templates directory.
	 * This makes the system modular: just add a folder with meta.json to add a template.
	 */
	async listTemplates(): Promise<TemplateMetadata[]> {
		try {
			// Ensure directory exists
			await fs.mkdir(this.templatesDir, { recursive: true });
			
			const folders = await fs.readdir(this.templatesDir);
			const templates: TemplateMetadata[] = [];

			for (const folder of folders) {
				const configPath = path.join(this.templatesDir, folder, "meta.json");
				try {
					const stats = await fs.stat(configPath);
					if (stats.isFile()) {
						const configContent = await fs.readFile(configPath, "utf-8");
						const config = JSON.parse(configContent);
						templates.push({
							id: folder,
							...config,
						});
					}
				} catch (e) {
					// Skip folders without valid meta.json or other errors
					logger.debug(`Skipping folder ${folder} in templates: No valid meta.json found`);
				}
			}
			return templates;
		} catch (error) {
			logger.error("Error listing templates:", error);
			return [];
		}
	}

	/**
	 * Gets the content of a specific template's main LaTeX file.
	 */
	async getTemplateContent(id: string): Promise<string> {
		const templates = await this.listTemplates();
		const metadata = templates.find((t) => t.id === id);
		
		if (!metadata) {
			throw new Error(`Template with id ${id} not found`);
		}

		const filePath = path.join(this.templatesDir, id, metadata.mainFile);
		try {
			return await fs.readFile(filePath, "utf-8");
		} catch (error) {
			logger.error(`Error reading template content for ${id}:`, error);
			throw new Error(`Could not read template content for ${id}`);
		}
	}

	/**
	 * Gets all secondary files (assets like .cls, .sty, .bib) for a template.
	 * Excludes meta.json and the main template file.
	 */
	async getTemplateAssets(id: string): Promise<{ name: string; path: string }[]> {
		const templates = await this.listTemplates();
		const metadata = templates.find((t) => t.id === id);
		
		if (!metadata) {
			throw new Error(`Template with id ${id} not found`);
		}

		const templateFolderPath = path.join(this.templatesDir, id);
		try {
			const assets: { name: string; path: string }[] = [];

			const walk = async (currentPath: string) => {
				const entries = await fs.readdir(currentPath, { withFileTypes: true });

				for (const entry of entries) {
					const entryPath = path.join(currentPath, entry.name);

					if (entry.isDirectory()) {
						await walk(entryPath);
						continue;
					}

					// Exclude metadata, main template file, and thumbnails
					if (
						entry.name === "meta.json" ||
						entry.name === metadata.mainFile ||
						entry.name === "thumbnail.png" ||
						entry.name === "thumbnail.jpg"
					) {
						continue;
					}

					const relativePath = path.relative(templateFolderPath, entryPath);
					assets.push({
						name: relativePath.split(path.sep).join("/"),
						path: entryPath,
					});
				}
			};

			await walk(templateFolderPath);
			return assets;
		} catch (error) {
			logger.error(`Error reading template assets for ${id}:`, error);
			return [];
		}
	}
}

export const templateService = new TemplateService();
