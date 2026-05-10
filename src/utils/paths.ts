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
	if (
		env.NODE_ENV === "production" ||
		process.env.npm_lifecycle_event === "start"
	) {
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
	const baseDir =
		env.NODE_ENV === "production" || process.env.npm_lifecycle_event === "start"
			? "dist"
			: "src";
	return path.join(projectRoot, baseDir, "templates", "files");
}

/**
 * Securely joins paths and ensures the result is within the base directory.
 * Prevents directory traversal attacks.
 */
export function safeJoin(base: string, ...parts: string[]): string {
	const joined = path.join(base, ...parts);
	const resolvedBase = path.resolve(base);
	const resolvedJoined = path.resolve(joined);

	if (!resolvedJoined.startsWith(resolvedBase)) {
		throw new Error("Potential directory traversal attempt detected");
	}

	return resolvedJoined;
}

export default {
	getProjectRoot,
	getTemplatesDir,
	safeJoin,
};
