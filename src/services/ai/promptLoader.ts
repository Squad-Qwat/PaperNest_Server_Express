import fs from "fs";
import path from "path";

/**
 * Utility to load AI prompts from markdown files
 * This is server-side only to avoid leaking large prompt strings to the client
 */
export const loadPrompt = async (name: string): Promise<string> => {
	try {
		// Path relatif terhadap process.cwd() dari backend
		const promptPath = path.join(
			process.cwd(),
			"src/services/ai/prompts",
			`${name}.md`,
		);

		if (!fs.existsSync(promptPath)) {
			console.warn(`[PromptLoader] Prompt file not found: ${promptPath}`);
			return "";
		}

		return fs.readFileSync(promptPath, "utf8");
	} catch (error) {
		console.error(`[PromptLoader] Error loading prompt "${name}":`, error);
		return "";
	}
};

/**
 * Load multiple prompts at once
 */
export const loadPrompts = async (
	names: string[],
): Promise<Record<string, string>> => {
	const prompts: Record<string, string> = {};

	await Promise.all(
		names.map(async (name) => {
			prompts[name] = await loadPrompt(name);
		}),
	);

	return prompts;
};
