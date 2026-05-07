import path from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env";

/**
 * Get the project root directory
 * Works correctly in both development (src) and production (dist)
 */
export function getProjectRoot(): string {
	// In production, this file is at dist/utils/paths.js
	// __dirname will be {projectRoot}/dist/utils
	// Going up 2 levels gets us to projectRoot
	if (env.NODE_ENV === "production" || process.env.npm_lifecycle_event === "start") {
		// We're running from dist
		return path.join(__dirname, "..", "..");
	}

	// In development with ts-node, __dirname is {projectRoot}/src/utils
	// Going up 2 levels gets us to projectRoot
	return path.join(__dirname, "..", "..");
}

/**
 * Get the templates directory
 * Resolves correctly whether running from src or dist
 */
export function getTemplatesDir(): string {
	const projectRoot = getProjectRoot();
	return path.join(projectRoot, "src", "templates", "files");
}

export default {
	getProjectRoot,
	getTemplatesDir,
};
