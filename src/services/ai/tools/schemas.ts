import { tool } from '@langchain/core/tools'
import { z } from 'zod'

/**
				description: 'Insert content with robust placement: cursor/start/end (LaTeX-safe before end-document marker), specific line (atLine), or text anchors (afterText/beforeText). For new sections, use get_sections first.',
 *
 * These tools are intentionally limited to handlers implemented in
 * `executeEditorTool` on the client side.
 */
export const createCodeMirrorTools = () => {
	return [
		tool(
			async ({ fromLine, toLine, full }) => JSON.stringify({ action: 'read_document', fromLine, toLine, full: full ?? false }),
			{
				name: 'read_document',
				description: 'Read document content. AVOID full=true for large files; instead, use fromLine/toLine for precision based on search_text_lines results. Defaults to a 50-line preview if no parameters are provided.',
				schema: z.object({
					fromLine: z.number().optional().describe('Start line number (1-based)'),
					toLine: z.number().optional().describe('End line number (inclusive)'),
					full: z.boolean().optional().default(false).describe('Read the entire document. WARNING: Use only for tiny files (< 50 lines). For larger files, it will be truncated.'),
				}),
			}
		),
		tool(
			async ({ content, position, atLine, afterText, beforeText, occurrence, caseSensitive }) =>
				JSON.stringify({ action: 'insert_content', content, position, atLine, afterText, beforeText, occurrence, caseSensitive }),
			{
				name: 'insert_content',
				description: 'Insert content with robust placement: cursor/start/end (LaTeX-safe before end-document marker), specific line (atLine), or text anchors (afterText/beforeText). For new sections, use get_sections first.',
				schema: z.object({
					content: z.string().describe('Text content to insert'),
					position: z.enum(['cursor', 'start', 'end']).optional().describe('Basic insertion position.'),
					atLine: z.number().optional().describe('Insert at start of this 1-based line.'),
					afterText: z.string().optional().describe('Insert after this exact anchor text.'),
					beforeText: z.string().optional().describe('Insert before this exact anchor text.'),
					occurrence: z.number().optional().describe('Occurrence index for anchor match (1-based). Defaults to 1 when unique.'),
					caseSensitive: z.boolean().optional().describe('Case-sensitive anchor match. Defaults to false.'),
				}),
			}
		),
		tool(
			async ({ searchBlock, replaceBlock }) =>
				JSON.stringify({ action: 'apply_diff_edit', searchBlock, replaceBlock }),
			{
				name: 'apply_diff_edit',
				description:
					'Apply array-based block replacement. Each searchBlock item is replaced with the corresponding replaceBlock item by index.',
				schema: z.object({
					searchBlock: z.array(z.string()).describe('Array of search text blocks.'),
					replaceBlock: z.array(z.string()).describe('Array of replacement text blocks.'),
				}),
			}
		),
		tool(
			async () => JSON.stringify({ action: 'get_sections' }),
			{
				name: 'get_sections',
				description: 'Get LaTeX section headings from current document. Use this before inserting new sections (e.g., Kesimpulan/Conclusion) to keep structure correct.',
				schema: z.object({}),
			}
		),
		tool(
			async ({ query, caseSensitive }) => JSON.stringify({ action: 'search_text_lines', query, caseSensitive }),
			{
				name: 'search_text_lines',
				description: 'Search for text within the document by line content. Returns matching line numbers and text.',
				schema: z.object({
					query: z.string().describe('Text to search for'),
					caseSensitive: z.boolean().optional().describe('Whether search is case-sensitive. Defaults to false.'),
				}),
			}
		),
		tool(
			async ({ fromLine, toLine, newContent }) => JSON.stringify({ action: 'replace_lines', fromLine, toLine, newContent }),
			{
				name: 'replace_lines',
				description: 'Replace content in a range of lines. More robust than apply_diff_edit for multi-line changes.',
				schema: z.object({
					fromLine: z.number().describe('Start line number (1-based)'),
					toLine: z.number().describe('End line number (inclusive)'),
					newContent: z.string().describe('New content to insert'),
				}),
			}
		),
		tool(
			async () => JSON.stringify({ action: 'compile_latex' }),
			{
				name: 'compile_latex',
				description: 'Trigger LaTeX compilation to generate PDF and check for errors. ALWAYS call this after making changes to verify they work.',
				schema: z.object({}),
			}
		),
		tool(
			async () => JSON.stringify({ action: 'get_compile_logs' }),
			{
				name: 'get_compile_logs',
				description: 'Get the LaTeX compilation logs. Use this if compile_latex reported errors to understand what went wrong.',
				schema: z.object({}),
			}
		),
	]
}
