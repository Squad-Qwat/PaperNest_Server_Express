import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import logger from "../utils/logger";

export class SynctexService {
	/**
	 * Executes a terminal command.
	 */
	private executeCommand(cmd: string): Promise<string> {
		return new Promise((resolve, reject) => {
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr || error.message));
				} else {
					resolve(stdout);
				}
			});
		});
	}

	/**
	 * Maps PDF coordinates (page, x, y) back to the original source line.
	 */
	async syncToCode(
		documentId: string,
		page: number,
		x: number,
		y: number,
	): Promise<{ file: string; line: number; column: number } | null> {
		const tempRoot = path.join(process.cwd(), "temp");
		const persistentDir = path.join(tempRoot, "compiled", documentId);

		try {
			const files = await fs.readdir(persistentDir);
			const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
			if (!pdfFile) {
				logger.warn(`[SynctexService] No PDF found in persistent dir for document ${documentId}`);
				return null;
			}

			const pdfPath = path.join(persistentDir, pdfFile);
			const cmd = `synctex edit -o "${page}:${x}:${y}:${pdfPath}"`;
			logger.info(`[SynctexService] Executing: ${cmd}`);
			const output = await this.executeCommand(cmd);

			const fileMatch = output.match(/Input:(.+)/i);
			const lineMatch = output.match(/Line:(\d+)/i);
			const colMatch = output.match(/Column:(\d+)/i);

			if (fileMatch && lineMatch) {
				const fullPath = fileMatch[1].trim();
				const filename = path.basename(fullPath);
				return {
					file: filename,
					line: parseInt(lineMatch[1], 10),
					column: colMatch ? parseInt(colMatch[1], 10) : 0,
				};
			}
		} catch (error: any) {
			logger.error(`[SynctexService] syncToCode error: ${error.message}`);
		}
		return null;
	}

	/**
	 * Maps a source line back to PDF coordinates (page, x, y).
	 */
	async syncToPdf(
		documentId: string,
		file: string,
		line: number,
		column: number,
	): Promise<{ page: number; x: number; y: number } | null> {
		const tempRoot = path.join(process.cwd(), "temp");
		const persistentDir = path.join(tempRoot, "compiled", documentId);

		try {
			const files = await fs.readdir(persistentDir);
			const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
			if (!pdfFile) {
				logger.warn(`[SynctexService] No PDF found in persistent dir for document ${documentId}`);
				return null;
			}

			const pdfPath = path.join(persistentDir, pdfFile);
			const cmd = `synctex view -i "${line}:${column}:${file}" -o "${pdfPath}"`;
			logger.info(`[SynctexService] Executing: ${cmd}`);
			const output = await this.executeCommand(cmd);

			const pageMatch = output.match(/Page:(\d+)/i);
			const xMatch = output.match(/x:([+-]?([0-9]*[.])?[0-9]+)/i);
			const yMatch = output.match(/y:([+-]?([0-9]*[.])?[0-9]+)/i);

			if (pageMatch && xMatch && yMatch) {
				return {
					page: parseInt(pageMatch[1], 10),
					x: parseFloat(xMatch[1]),
					y: parseFloat(yMatch[1]),
				};
			}
		} catch (error: any) {
			logger.error(`[SynctexService] syncToPdf error: ${error.message}`);
		}
		return null;
	}
}

export const synctexService = new SynctexService();
