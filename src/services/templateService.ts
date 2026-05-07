import fs from "fs/promises";
import path from "path";
import type { TemplateMetadata } from "../types";
import logger from "../utils/logger";
import { getTemplatesDir } from "../utils/paths";
import { TEMPLATE_LIMITS } from "../config/constants";

export class TemplateService {
	private templatesDir = getTemplatesDir();

	async listTemplates(): Promise<TemplateMetadata[]> {
		try {
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
					logger.debug(`Skipping folder ${folder} in templates: No valid meta.json found`);
				}
			}
			return templates;
		} catch (error) {
			logger.error("Error listing templates:", error);
			return [];
		}
	}

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

	async getTemplateAssets(id: string): Promise<{ name: string; path: string }[]> {
		const templates = await this.listTemplates();
		const metadata = templates.find((t) => t.id === id);
		
		if (!metadata) {
			throw new Error(`Template with id ${id} not found`);
		}

		const templateFolderPath = path.join(this.templatesDir, id);
		try {
			const assets: { name: string; path: string }[] = [];
			let totalSize = 0;
			let assetCount = 0;

			const walk = async (currentPath: string) => {
				const entries = await fs.readdir(currentPath, { withFileTypes: true });

				for (const entry of entries) {
					const entryPath = path.join(currentPath, entry.name);

					if (entry.isDirectory()) {
						await walk(entryPath);
						continue;
					}

					assetCount++;
					if (assetCount > TEMPLATE_LIMITS.MAX_ASSETS_COUNT) {
						logger.warn(`Template ${id} exceeds max asset count (${TEMPLATE_LIMITS.MAX_ASSETS_COUNT})`);
						continue;
					}

					if (
						entry.name === "meta.json" ||
						entry.name === metadata.mainFile ||
						entry.name === "thumbnail.png" ||
						entry.name === "thumbnail.jpg"
					) {
						continue;
					}

					const stat = await fs.stat(entryPath);
					
					if (stat.size > TEMPLATE_LIMITS.MAX_ASSET_SIZE) {
						logger.warn(`Asset ${entry.name} exceeds size limit (${stat.size} > ${TEMPLATE_LIMITS.MAX_ASSET_SIZE})`);
						continue;
					}

					totalSize += stat.size;
					if (totalSize > TEMPLATE_LIMITS.MAX_TEMPLATE_SIZE) {
						logger.warn(`Template ${id} total size exceeds limit (${totalSize} > ${TEMPLATE_LIMITS.MAX_TEMPLATE_SIZE})`);
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
