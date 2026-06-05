import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import logger from "../utils/logger";

export class SynctexService {
	private executeCommand(file: string, args: string[]): Promise<string> {
		return new Promise((resolve, reject) => {
			execFile(file, args, (error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr || error.message));
				} else {
					resolve(stdout);
				}
			});
		});
	}

	private async resolveInputPath(
		persistentDir: string,
		targetFilename: string,
	): Promise<string> {
		try {
			const files = await fs.readdir(persistentDir);
			const synctexFile = files.find((f) => f.toLowerCase().endsWith(".synctex.gz"));
			if (!synctexFile) return targetFilename;

			const synctexPath = path.join(persistentDir, synctexFile);
			const compressedData = await fs.readFile(synctexPath);
			
			const gunzip = promisify(zlib.gunzip);
			const decompressed = await gunzip(compressedData);
			const content = decompressed.toString("utf-8");

			const lines = content.split(/\r?\n/);
			for (const line of lines) {
				const match = line.match(/^Input:(\d+):(.+)/i);
				if (match) {
					const registeredPath = match[2].trim();
					const registeredBase = path.basename(registeredPath);
					if (registeredBase.toLowerCase() === targetFilename.toLowerCase()) {
						logger.info(`[SynctexService] Resolved input path: ${targetFilename} -> ${registeredPath}`);
						return registeredPath;
					}
				}
			}
		} catch (error: any) {
			logger.error(`[SynctexService] Error resolving input path: ${error.message}`);
		}
		return targetFilename;
	}

	private async getPdfPathAndDir(
		documentId: string,
	): Promise<{ pdfPath: string; persistentDir: string } | null> {
		if (!/^[a-zA-Z0-9_-]+$/.test(documentId)) {
			logger.error(`[SynctexService] Invalid documentId: ${documentId}`);
			return null;
		}

		const tempRoot = path.join(process.cwd(), "temp");
		const persistentDir = path.join(tempRoot, "compiled", documentId);

		const files = await fs.readdir(persistentDir);
		const pdfFile = files.find((f) => f.toLowerCase().endsWith(".pdf"));
		if (!pdfFile) {
			logger.warn(`[SynctexService] No PDF found in persistent dir for document ${documentId}`);
			return null;
		}

		return {
			pdfPath: path.join(persistentDir, pdfFile),
			persistentDir,
		};
	}

	async syncToCode(
		documentId: string,
		page: number,
		x: number,
		y: number,
	): Promise<{ file: string; line: number; column: number } | null> {
		try {
			const resolved = await this.getPdfPathAndDir(documentId);
			if (!resolved) return null;

			const { pdfPath } = resolved;
			logger.info(`[SynctexService] Executing synctex edit for document ${documentId}`);
			const output = await this.executeCommand("synctex", [
				"edit",
				"-o",
				`${page}:${x}:${y}:${pdfPath}`,
			]);

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

	async syncToPdf(
		documentId: string,
		file: string,
		line: number,
		column: number,
	): Promise<{
		page: number;
		x: number;
		y: number;
		h?: number;
		v?: number;
		width?: number;
		height?: number;
	} | null> {
		try {
			const resolved = await this.getPdfPathAndDir(documentId);
			if (!resolved) return null;

			const { pdfPath, persistentDir } = resolved;
			const safeFile = path.basename(file);
			const resolvedInputPath = await this.resolveInputPath(persistentDir, safeFile);
			logger.info(`[SynctexService] Executing synctex view for document ${documentId}`);
			const output = await this.executeCommand("synctex", [
				"view",
				"-i",
				`${line}:${column}:${resolvedInputPath}`,
				"-o",
				pdfPath,
			]);

			const pageMatch = output.match(/Page:(\d+)/i);
			const xMatch = output.match(/x:([+-]?([0-9]*[.])?[0-9]+)/i);
			const yMatch = output.match(/y:([+-]?([0-9]*[.])?[0-9]+)/i);
			const hMatch = output.match(/h:([+-]?([0-9]*[.])?[0-9]+)/i);
			const vMatch = output.match(/v:([+-]?([0-9]*[.])?[0-9]+)/i);
			const widthMatch = output.match(/W:([+-]?([0-9]*[.])?[0-9]+)/i);
			const heightMatch = output.match(/H:([+-]?([0-9]*[.])?[0-9]+)/i);

			if (pageMatch && xMatch && yMatch) {
				return {
					page: parseInt(pageMatch[1], 10),
					x: parseFloat(xMatch[1]),
					y: parseFloat(yMatch[1]),
					h: hMatch ? parseFloat(hMatch[1]) : parseFloat(xMatch[1]),
					v: vMatch ? parseFloat(vMatch[1]) : parseFloat(yMatch[1]),
					width: widthMatch ? parseFloat(widthMatch[1]) : 0,
					height: heightMatch ? parseFloat(heightMatch[1]) : 0,
				};
			}
		} catch (error: any) {
			logger.error(`[SynctexService] syncToPdf error: ${error.message}`);
		}
		return null;
	}
}

export const synctexService = new SynctexService();
