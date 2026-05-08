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
	 *
	 * @param options - Compilation options including .tex content and assets
	 * @returns The compiled PDF buffer and logs
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
				const { StorageService } = await import("./StorageService.js");
				await Promise.all(
					assets.map(async (asset) => {
						try {
							// Sanitize name to prevent path traversal (e.g. ../../../etc/passwd)
							const safeName = asset.name.replace(/\.\.+/g, ".").replace(/^[\/\\]+/, "");
							const assetPath = path.join(workDir, safeName);
							const assetDir = path.dirname(assetPath);

							// Safety check: ensure assetPath is actually inside workDir
							if (!assetPath.startsWith(workDir)) {
								throw new Error(`Invalid asset path: ${asset.name}`);
							}

							// Ensure subdirectories exist for assets (e.g. images/logo.png)
							if (assetDir !== workDir) {
								await fs.mkdir(assetDir, { recursive: true });
							}

							let fileData: Buffer;

							if (asset.r2Key) {
								// Prefer direct R2 download to avoid 403 Forbidden on public URLs
								logger.debug(
									`[LatexService] Fetching asset via R2 Key: ${asset.r2Key}`,
								);
								const response = await StorageService.getObject(asset.r2Key);
								const streamToBuffer = async (stream: any): Promise<Buffer> => {
									return new Promise((resolve, reject) => {
										const chunks: any[] = [];
										stream.on("data", (chunk: any) => chunks.push(chunk));
										stream.on("error", reject);
										stream.on("end", () => resolve(Buffer.concat(chunks)));
									});
								};
								fileData = await streamToBuffer(response.Body);
							} else {
								// Fallback to public URL (might fail with 403 if bucket is private)
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
							// We continue even if an asset fails, Tectonic will report the error if it's critical
						}
					}),
				);
			}

			// 4. Execute Compiler
			let binaryPath = "tectonic";
			let args = [mainPath, "--outdir", workDir];

			if (engine === "pdflatex") {
				binaryPath = "pdflatex";
				args = [
					"-interaction=nonstopmode",
					`-output-directory=${workDir}`,
					mainPath,
				];
			}

			logger.info(
				`[LatexService] Executing: "${binaryPath}" ${args.join(" ")}`,
			);

			let log = "";
			let status = 0;

			// Wrap spawn in a promise
			await new Promise<void>((resolve) => {
				// We use shell: false (default) to avoid CMD quoting issues with spaces
				const compilerProcess = spawn(binaryPath, args, {
					cwd: workDir,
					env: process.env, // Inherit current environment
				});

				compilerProcess.stdout.on("data", (data: Buffer) => {
					const chunk = data.toString();
					log += chunk;
				});

				compilerProcess.stderr.on("data", (data: Buffer) => {
					const chunk = data.toString();
					log += chunk;
				});

				compilerProcess.on("close", (code: number | null) => {
					status = code || 0;
					if (status !== 0) {
						// We log but don't resolve as fail yet - we'll check if a PDF was produced anyway
						logger.warn(
							`[LatexService] ${binaryPath} exited with code ${status}. Checking for output PDF...`,
						);
					}
					resolve();
				});

				compilerProcess.on("error", (err: Error) => {
					status = -1;
					log += `Error spawning ${binaryPath}: ${err.message}\n`;
					log += `Path attempted: ${binaryPath}\n`;
					logger.error(`[LatexService] Spawn error: ${err.message}`);
					resolve();
				});
			});

			// 5. Read resulting PDF
			const pdfFileName = mainFileName.replace(/\.(tex|ltx)$/i, "") + ".pdf";
			const pdfPath = path.join(workDir, pdfFileName);

			let pdfBuffer: Buffer | undefined;
			try {
				pdfBuffer = await fs.readFile(pdfPath);
				logger.info(
					`[LatexService] PDF generated successfully: ${pdfFileName}`,
				);
			} catch (e) {
				logger.error(
					`[LatexService] PDF not found after compilation: ${pdfPath}`,
				);
			}

			return {
				pdf: pdfBuffer,
				log,
				status,
			};
		} finally {
			// 6. Cleanup
			try {
				await fs.rm(workDir, { recursive: true, force: true });
				logger.info(`[LatexService] Cleaned up work directory: ${workDir}`);
			} catch (cleanupError) {
				logger.error(
					`[LatexService] Cleanup failed for ${workDir}:`,
					cleanupError,
				);
			}
		}
	}
}

export const latexService = new LatexService();
