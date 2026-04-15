import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface LatexCompileOptions {
  content: string;
  mainFileName?: string;
  assets?: Array<{ name: string; url: string }>;
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
    const { content, mainFileName = 'main.tex', assets = [] } = options;
    
    // Use a project-local temp directory to avoid Snap/Flatpak permission issues on Linux/GCP
    const tempRoot = path.join(process.cwd(), 'temp');
    const workDir = path.join(tempRoot, `papernest-latex-${uuidv4()}`);
    
    try {
      // 1. Create temporary workspace (ensure parent tempRoot exists too)
      await fs.mkdir(tempRoot, { recursive: true });
      await fs.mkdir(workDir, { recursive: true });
      logger.info(`[LatexService] Created work directory: ${workDir}`);

      // 2. Write main .tex file
      const mainPath = path.join(workDir, mainFileName);
      await fs.writeFile(mainPath, content);

      // 3. Download and place assets
      if (assets.length > 0) {
        await Promise.all(assets.map(async (asset) => {
          try {
            const assetPath = path.join(workDir, asset.name);
            const assetDir = path.dirname(assetPath);
            
            // Ensure subdirectories exist for assets (e.g. images/logo.png)
            if (assetDir !== workDir) {
              await fs.mkdir(assetDir, { recursive: true });
            }

            const response = await axios.get(asset.url, { responseType: 'arraybuffer' });
            await fs.writeFile(assetPath, Buffer.from(response.data));
            logger.debug(`[LatexService] Downloaded asset: ${asset.name}`);
          } catch (error: any) {
            logger.error(`[LatexService] Failed to download asset ${asset.name}: ${error.message}`);
            // We continue even if an asset fails, Tectonic will report the error if it's critical
          }
        }));
      }

      // 4. Execute Tectonic
      // We assume 'tectonic' is in the system PATH
      const binaryPath = 'tectonic';
      const args = [
        mainPath,
        '--outdir', workDir,
        '--noninteractive' // Prevent hanging in server environments
      ];
      
      logger.info(`[LatexService] Executing: "${binaryPath}" ${args.join(' ')}`);

      let log = '';
      let status = 0;

      // Wrap spawn in a promise
      await new Promise<void>((resolve) => {
        // We use shell: false (default) to avoid CMD quoting issues with spaces
        const tectonicProcess = spawn(binaryPath, args, { 
          cwd: workDir,
          env: process.env // Inherit current environment
        });

        tectonicProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString();
          log += chunk;
        });

        tectonicProcess.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString();
          log += chunk;
        });

        tectonicProcess.on('close', (code: number | null) => {
          status = code || 0;
          if (status !== 0) {
            // We log but don't resolve as fail yet - we'll check if a PDF was produced anyway
            logger.warn(`[LatexService] Tectonic exited with code ${status}. Checking for output PDF...`);
          }
          resolve();
        });

        tectonicProcess.on('error', (err: Error) => {
          status = -1;
          log += `Error spawning tectonic: ${err.message}\n`;
          log += `Path attempted: ${binaryPath}\n`;
          logger.error(`[LatexService] Spawn error: ${err.message}`);
          resolve();
        });
      });

      // 5. Read resulting PDF
      const pdfFileName = mainFileName.replace(/\.(tex|ltx)$/i, '') + '.pdf';
      const pdfPath = path.join(workDir, pdfFileName);
      
      let pdfBuffer: Buffer | undefined;
      try {
        pdfBuffer = await fs.readFile(pdfPath);
        logger.info(`[LatexService] PDF generated successfully: ${pdfFileName}`);
      } catch (e) {
        logger.error(`[LatexService] PDF not found after compilation: ${pdfPath}`);
      }

      return {
        pdf: pdfBuffer,
        log,
        status
      };

    } finally {
      // 6. Cleanup
      try {
        await fs.rm(workDir, { recursive: true, force: true });
        logger.info(`[LatexService] Cleaned up work directory: ${workDir}`);
      } catch (cleanupError) {
        logger.error(`[LatexService] Cleanup failed for ${workDir}:`, cleanupError);
      }
    }
  }
}

export const latexService = new LatexService();
