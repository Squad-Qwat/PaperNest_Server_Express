import axios from "axios";
import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";
import logger from "../utils/logger";

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

/**
 * Service to handle LaTeX compilation using Tectonic.
 * Designed to be modular and decoupled from the Express layer.
 */
export class LatexService {
	/**
	 * Compiles LaTeX content into a PDF.
	 */
	async compile(options: LatexCompileOptions): Promise<LatexCompileResult> {
		const {
			content,
			mainFileName = "main.tex",
			assets = [],
			engine = "pdflatex",
		} = options;

		const tempRoot = path.join(process.cwd(), "temp");
		const workDir = path.join(tempRoot, `papernest-latex-${uuidv4()}`);

		try {
			await fs.mkdir(tempRoot, { recursive: true });
			await fs.mkdir(workDir, { recursive: true });
			logger.info(`[LatexService] Created work directory: ${workDir}`);

			const mainPath = path.join(workDir, mainFileName);
			await fs.writeFile(mainPath, content);

			if (assets.length > 0) {
				const { StorageService } = await import("./StorageService");
				await Promise.all(
					assets.map(async (asset) => {
						try {
							const safeName = asset.name.replace(/\.\.+/g, ".").replace(/^[\/\\]+/, "");
							const assetPath = path.join(workDir, safeName);
							const assetDir = path.dirname(assetPath);

							if (!assetPath.startsWith(workDir)) {
								throw new Error(`Invalid asset path: ${asset.name}`);
							}

							if (assetDir !== workDir) {
								await fs.mkdir(assetDir, { recursive: true });
							}

							let fileData: Buffer;

							if (asset.r2Key) {
								logger.debug(`[LatexService] Fetching asset via R2 Key: ${asset.r2Key}`);
								const response = await StorageService.getObject(asset.r2Key);
								const chunks: any[] = [];
								const stream = response.Body as any;
								for await (const chunk of stream) {
									chunks.push(chunk);
								}
								fileData = Buffer.concat(chunks);
							} else {
								logger.debug(`[LatexService] Downloading asset via URL: ${asset.url}`);
								const response = await axios.get(asset.url, {
									responseType: "arraybuffer",
								});
								fileData = Buffer.from(response.data);
							}

							await fs.writeFile(assetPath, fileData);
							logger.debug(`[LatexService] Saved asset: ${asset.name}`);
						} catch (error: any) {
							logger.error(
								`[LatexService] Failed to download asset ${asset.name}: ${error.message}`,
							);
						}
					}),
				);
			}

			let log = "";
			let status = 0;
			const hasBibFile = assets.some((a) => a.name.toLowerCase().endsWith(".bib"));

			if (engine === "pdflatex") {
				const pdflatexArgs = [
					"-interaction=nonstopmode",
					`-output-directory=${workDir}`,
					mainPath,
				];

				// Pass 1: Initial compilation
				const res1 = await this.executeCommand("pdflatex", pdflatexArgs, workDir);
				log += res1.output;
				status = res1.status;

				if (hasBibFile && status === 0) {
					const auxName = mainFileName.replace(/\.(tex|ltx)$/i, "");
					
					// BibTeX pass
					const resBib = await this.executeCommand("bibtex", [auxName], workDir);
					log += "\n--- BibTeX Log ---\n" + resBib.output;

					// Pass 2 & 3: Resolve citations and references
					const res2 = await this.executeCommand("pdflatex", pdflatexArgs, workDir);
					log += "\n--- Pass 2 Log ---\n" + res2.output;
					
					const res3 = await this.executeCommand("pdflatex", pdflatexArgs, workDir);
					log += "\n--- Pass 3 Log ---\n" + res3.output;
					status = res3.status;
				}
			} else {
				// Tectonic handles multiple passes internally
				const tectonicArgs = [mainPath, "--outdir", workDir];
				const res = await this.executeCommand("tectonic", tectonicArgs, workDir);
				log = res.output;
				status = res.status;
			}

			const pdfFileName = mainFileName.replace(/\.(tex|ltx)$/i, "") + ".pdf";
			const pdfPath = path.join(workDir, pdfFileName);

			let pdfBuffer: Buffer | undefined;
			try {
				pdfBuffer = await fs.readFile(pdfPath);
				logger.info(`[LatexService] PDF generated successfully: ${pdfFileName}`);
			} catch (e) {
				logger.error(`[LatexService] PDF not found after compilation: ${pdfPath}`);
			}

			return { pdf: pdfBuffer, log, status };
		} finally {
			try {
				await fs.rm(workDir, { recursive: true, force: true });
				logger.info(`[LatexService] Cleaned up work directory: ${workDir}`);
			} catch (cleanupError) {
				logger.error(`[LatexService] Cleanup failed for ${workDir}:`, cleanupError);
			}
		}
	}

	/**
	 * Executes a command and captures its output.
	 */
	private async executeCommand(
		binary: string,
		args: string[],
		cwd: string,
	): Promise<{ output: string; status: number }> {
		logger.info(`[LatexService] Executing: "${binary}" ${args.join(" ")}`);

		return new Promise((resolve) => {
			let output = "";
			const proc = spawn(binary, args, { cwd, env: process.env });

			proc.stdout.on("data", (data) => (output += data.toString()));
			proc.stderr.on("data", (data) => (output += data.toString()));

			proc.on("close", (code) => {
				resolve({ output, status: code || 0 });
			});

			proc.on("error", (err) => {
				logger.error(`[LatexService] Failed to start ${binary}: ${err.message}`);
				resolve({ output: `Error: ${err.message}\n` + output, status: -1 });
			});
		});
	}
}

export const latexService = new LatexService();
