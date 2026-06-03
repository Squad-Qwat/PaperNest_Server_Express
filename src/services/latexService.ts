import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";

const uuidv4 = () => crypto.randomUUID();

import { env } from "../config/env";
import type {
	LatexCompileOptions,
	LatexCompileResult,
} from "../types/latex.types";

import logger from "../utils/logger";

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
			documentId,
		} = options;

		// Basic security filtering for malicious LaTeX commands (RCE protection)
		const maliciousCommands = [
			/\\write18/i,
			/\\shellescape/i,
			/\\openout/i,
			/\\openin/i,
		];

		const useDocker =
			process.env.USE_DOCKER_SANDBOX === "true" ||
			env.NODE_ENV === "production";
		if (!useDocker) {
			for (const regex of maliciousCommands) {
				if (regex.test(content)) {
					logger.warn(
						`[LatexService] Security validation failed for local compilation: ${regex.source}`,
					);
					return {
						pdf: undefined,
						log: `Security Error: Malicious command detected in LaTeX content: ${regex.source}`,
						status: -1,
					};
				}
			}
		}

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
							const safeName = asset.name
								.replace(/\.\.+/g, ".")
								.replace(/^[/\\]+/, "");
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
								logger.debug(
									`[LatexService] Fetching asset via R2 Key: ${asset.r2Key}`,
								);
								const response = await StorageService.getObject(asset.r2Key);
								const chunks: any[] = [];
								const stream = response.Body as any;
								for await (const chunk of stream) {
									chunks.push(chunk);
								}
								fileData = Buffer.concat(chunks);
							} else {
								logger.debug(
									`[LatexService] Downloading asset via URL: ${asset.url}`,
								);
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
			const hasBibFile = assets.some((a) =>
				a.name.toLowerCase().endsWith(".bib"),
			);

			if (engine === "pdflatex") {
				const pdflatexArgs = [
					"-interaction=nonstopmode",
					"-synctex=1",
					`-output-directory=${workDir}`,
					mainPath,
				];

				// Pass 1: Initial compilation
				const res1 = await this.executeCommand(
					"pdflatex",
					pdflatexArgs,
					workDir,
				);
				log += res1.output;
				status = res1.status;

				if (hasBibFile && status === 0) {
					const auxName = mainFileName.replace(/\.(tex|ltx)$/i, "");

					// BibTeX pass
					const resBib = await this.executeCommand(
						"bibtex",
						[auxName],
						workDir,
					);
					log += `\n--- BibTeX Log ---\n${resBib.output}`;

					// Pass 2 & 3: Resolve citations and references
					const res2 = await this.executeCommand(
						"pdflatex",
						pdflatexArgs,
						workDir,
					);
					log += `\n--- Pass 2 Log ---\n${res2.output}`;

					const res3 = await this.executeCommand(
						"pdflatex",
						pdflatexArgs,
						workDir,
					);
					log += `\n--- Pass 3 Log ---\n${res3.output}`;
					status = res3.status;
				}
			} else {
				// Tectonic handles multiple passes internally
				const tectonicArgs = [mainPath, "--outdir", workDir, "--synctex"];
				const res = await this.executeCommand(
					"tectonic",
					tectonicArgs,
					workDir,
				);
				log = res.output;
				status = res.status;
			}

			const pdfFileName = `${mainFileName.replace(/\.(tex|ltx)$/i, "")}.pdf`;
			const pdfPath = path.join(workDir, pdfFileName);
			const synctexFileName = `${mainFileName.replace(/\.(tex|ltx)$/i, "")}.synctex.gz`;
			const synctexPath = path.join(workDir, synctexFileName);

			let pdfBuffer: Buffer | undefined;
			try {
				pdfBuffer = await fs.readFile(pdfPath);
				logger.info(
					`[LatexService] PDF generated successfully: ${pdfFileName}`,
				);

				if (documentId) {
					const persistentDir = path.join(tempRoot, "compiled", documentId);
					await fs.mkdir(persistentDir, { recursive: true });
					try {
						await fs.copyFile(pdfPath, path.join(persistentDir, pdfFileName));
						await fs.copyFile(synctexPath, path.join(persistentDir, synctexFileName));
						logger.info(`[LatexService] Saved pdf and synctex to persistent cache for document: ${documentId}`);
					} catch (err: any) {
						logger.warn(`[LatexService] Failed to copy pdf or synctex to cache: ${err.message}`);
					}
				}
			} catch (_e) {
				logger.error(
					`[LatexService] PDF not found after compilation: ${pdfPath}`,
				);
			}

			return { pdf: pdfBuffer, log, status };
		} finally {
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

	/**
	 * Executes a command and captures its output.
	 */
	private async executeCommand(
		binary: string,
		args: string[],
		cwd: string,
	): Promise<{ output: string; status: number }> {
		const useDocker =
			process.env.USE_DOCKER_SANDBOX === "true" ||
			env.NODE_ENV === "production";
		const dockerImage =
			process.env.LATEX_DOCKER_IMAGE ||
			(binary === "tectonic"
				? "dxjoke/tectonic-docker:latest"
				: "blang/latex:ubuntu");

		let finalBinary = binary;
		let finalArgs = args;

		if (useDocker) {
			finalBinary = "docker";
			const mappedArgs = args.map((arg) => {
				const normalizedCwd = cwd.replace(/\\/g, "/");
				const normalizedArg = arg.replace(/\\/g, "/");
				return normalizedArg.replace(
					new RegExp(normalizedCwd, "g"),
					"/workspace",
				);
			});

			finalArgs = [
				"run",
				"--rm",
				"--network",
				"none",
				"-v",
				`${cwd}:/workspace`,
				"-w",
				"/workspace",
				dockerImage,
				binary,
				...mappedArgs,
			];
		}

		logger.info(
			`[LatexService] Executing: "${finalBinary}" ${finalArgs.slice(0, 10).join(" ")}`,
		);

		return new Promise((resolve) => {
			let output = "";
			const proc = spawn(finalBinary, finalArgs, { cwd, env: process.env });

			const timeoutMs = parseInt(
				process.env.LATEX_COMPILE_TIMEOUT || "30000",
				10,
			);
			const timeoutId = setTimeout(() => {
				logger.warn(
					`[LatexService] Compilation timed out for command: ${finalBinary} ${finalArgs.slice(0, 5).join(" ")}`,
				);
				proc.kill("SIGKILL");
				resolve({
					output: `${output}\nError: Compilation timed out after ${timeoutMs / 1000} seconds.\n`,
					status: -1,
				});
			}, timeoutMs);

			proc.stdout.on("data", (data) => (output += data.toString()));
			proc.stderr.on("data", (data) => (output += data.toString()));

			proc.on("close", (code) => {
				clearTimeout(timeoutId);
				resolve({ output, status: code || 0 });
			});

			proc.on("error", (err) => {
				clearTimeout(timeoutId);
				logger.error(
					`[LatexService] Failed to start command ${finalBinary}: ${err.message}`,
				);
				resolve({ output: `Error: ${err.message}\n${output}`, status: -1 });
			});
		});
	}
}

export const latexService = new LatexService();
