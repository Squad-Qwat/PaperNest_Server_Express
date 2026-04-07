'use client'

/**
 * Editor-side Tool Execution
 * These functions run in the browser and interact with the CodeMirror/LaTeX editor.
 * CodeMirror/LaTeX implementation only.
 */

type DiffPair = {
	index: number
	search: string
	replace: string
}

type DiffMatch = {
	pairIndex: number
	from: number
	to: number
	search: string
	replace: string
}

type AnchoredReplacePair = {
	search: string
	replace: string
}

const createStagedChangeId = (): string => `staged_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createAnchoredReplacePair = (
	docText: string,
	from: number,
	to: number,
	insert: string,
	contextWindow = 120
): AnchoredReplacePair | null => {
	const safeFrom = Math.max(0, Math.min(from, docText.length))
	const safeTo = Math.max(safeFrom, Math.min(to, docText.length))

	const leftStart = Math.max(0, safeFrom - contextWindow)
	const rightEnd = Math.min(docText.length, safeTo + contextWindow)

	const leftContext = docText.slice(leftStart, safeFrom)
	const target = docText.slice(safeFrom, safeTo)
	const rightContext = docText.slice(safeTo, rightEnd)

	const search = `${leftContext}${target}${rightContext}`
	const replace = `${leftContext}${insert}${rightContext}`

	if (!search || search.length === 0) return null

	return { search, replace }
}

const parseApplyDiffPairs = (args: any): { pairs?: DiffPair[]; error?: string } => {
	const { searchBlock, replaceBlock } = args || {}

	if (!Array.isArray(searchBlock) || !Array.isArray(replaceBlock)) {
		return { error: 'Error: apply_diff_edit requires both searchBlock and replaceBlock as arrays of strings.' }
	}

	if (searchBlock.length !== replaceBlock.length) {
		return { error: `Error: apply_diff_edit requires equal length arrays. searchBlock.length=${searchBlock.length}, replaceBlock.length=${replaceBlock.length}.` }
	}

	if (searchBlock.length === 0) {
		return { error: 'Error: apply_diff_edit requires at least one pair.' }
	}

	const normalizeSpaces = (text: string): string => {
		return text
			.split('\n')
			.map((line) => line.trimEnd())
			.join('\n')
			.trimStart()
	}

	const pairs: DiffPair[] = []
	for (let i = 0; i < searchBlock.length; i++) {
		let search = searchBlock[i]
		let replace = replaceBlock[i]

		if (typeof search !== 'string' || typeof replace !== 'string') {
			return { error: `Error: apply_diff_edit expects string values in arrays. Invalid value at index ${i}.` }
		}

		if (search.length === 0) {
			return { error: `Error: apply_diff_edit searchBlock[${i}] cannot be empty.` }
		}

		search = normalizeSpaces(search)
		replace = normalizeSpaces(replace)

		pairs.push({ index: i, search, replace })
	}

	return { pairs }
}

const findAtomicDiffMatches = (docText: string, pairs: DiffPair[]): { matches?: DiffMatch[]; error?: string } => {
	const candidateMatchesByPair: DiffMatch[][] = []
	const isDeletionByPair: boolean[] = []

	for (const pair of pairs) {
		const candidates: DiffMatch[] = []
		let searchFrom = 0
		const isDeletion = pair.replace.length === 0

		while (searchFrom <= docText.length) {
			const index = docText.indexOf(pair.search, searchFrom)
			if (index === -1) break

			candidates.push({
				pairIndex: pair.index,
				from: index,
				to: index + pair.search.length,
				search: pair.search,
				replace: pair.replace,
			})

			// For deletions, use only first match (deterministic)
			if (isDeletion) {
				searchFrom = docText.length + 1
				break
			}

			searchFrom = index + 1
		}

		if (candidates.length === 0) {
			return {
				error: `error: apply_diff_edit FAILED at index ${pair.index} — search text not found.\nreason: searchBlock[${pair.index}] does not exist exactly in document.\ninstructions: Use search_text_lines and replace_lines for this block, then retry batch if needed.`,
			}
		}

		candidateMatchesByPair.push(candidates)
		isDeletionByPair.push(isDeletion)
	}

	if (pairs.length === 1 && candidateMatchesByPair[0].length > 1 && !isDeletionByPair[0]) {
		return {
			error: `error: apply_diff_edit FAILED at index ${pairs[0].index} — search text is ambiguous.\nreason: searchBlock[${pairs[0].index}] appears multiple times; batch replacement is unsafe.\ninstructions: Disambiguate with line-based tools (search_text_lines + replace_lines).`,
		}
	}

	const solutions: DiffMatch[][] = []
	const current: DiffMatch[] = []

	const backtrack = (pairIdx: number, minStart: number) => {
		if (pairIdx === candidateMatchesByPair.length) {
			solutions.push([...current])
			return
		}

		// For deletions, always use first match (deterministic, no backtracking)
		if (isDeletionByPair[pairIdx]) {
			const candidate = candidateMatchesByPair[pairIdx][0]
			if (candidate && candidate.from >= minStart) {
				current.push(candidate)
				backtrack(pairIdx + 1, candidate.to)
				current.pop()
			}
		} else {
			// For non-deletions: use GREEDY matching (first valid candidate only)
			// This avoids "ambiguous match" errors by always picking earliest match
			const validCandidates = candidateMatchesByPair[pairIdx].filter(c => c.from >= minStart)
			if (validCandidates.length > 0) {
				const candidate = validCandidates[0] // Greedy: take earliest
				current.push(candidate)
				backtrack(pairIdx + 1, candidate.to)
				current.pop()
			}
		}
	}

	backtrack(0, 0)

	if (solutions.length === 0) {
		return {
			error: `error: apply_diff_edit FAILED — overlapping or out-of-order batch ranges detected.\nreason: provided search blocks cannot be mapped to one non-overlapping sequence in document order.\ninstructions: split the operation into smaller ordered edits.`,
		}
	}

	// With greedy matching, should always have exactly 1 solution now
	// (no more "ambiguous match" errors)
	return { matches: solutions[0] }
}

const applyMatchesToText = (docText: string, matches: DiffMatch[]): string => {
	let result = docText
	const sortedDesc = [...matches].sort((a, b) => b.from - a.from)

	for (const match of sortedDesc) {
		result = result.slice(0, match.from) + match.replace + result.slice(match.to)
	}

	return result
}

const findAllOccurrences = (text: string, search: string, caseSensitive = false): number[] => {
	const source = caseSensitive ? text : text.toLowerCase()
	const target = caseSensitive ? search : search.toLowerCase()
	const positions: number[] = []
	if (!target) return positions

	let cursor = 0
	while (cursor <= source.length) {
		const index = source.indexOf(target, cursor)
		if (index === -1) break
		positions.push(index)
		cursor = index + 1
	}

	return positions
}

const findLatexEndDocumentIndex = (text: string): number => text.lastIndexOf(String.raw`\end{document}`)

const findLatexBibliographyStart = (text: string, limitExclusive?: number): number | null => {
	const limit = typeof limitExclusive === 'number' ? limitExclusive : text.length
	const patterns = [
		/\\begin\{thebibliography\}/g,
		/\\printbibliography\b/g,
		/\\bibliography\s*\{/g,
		/\\(?:section|chapter)\*?\{\s*(?:references|reference|bibliography|daftar\s+pustaka)\s*\}/gi,
	]

	let bestIndex = -1
	for (const pattern of patterns) {
		pattern.lastIndex = 0
		let match: RegExpExecArray | null
		while ((match = pattern.exec(text)) !== null) {
			if (match.index < limit && match.index > bestIndex) {
				bestIndex = match.index
			}
		}
	}

	return bestIndex >= 0 ? bestIndex : null
}

const looksLikeLatexSectionContent = (content: string): boolean => {
	return /\\(?:chapter|section|subsection|subsubsection)\*?\{/.test(content)
}

/**
 * Primary tool execution dispatcher for AI interactions (CodeMirror/LaTeX only)
 */
/**
 * Primary tool execution dispatcher for AI interactions (CodeMirror/LaTeX only)
 */
export const executeEditorTool = async (
	editor: any,
	toolName: string,
	args: any,
	documentId?: string
): Promise<any> => {
	if (!editor) return 'Error: Editor not available'

	// Extract CodeMirror view from the editor wrapper provided by LatexEditor
	const view = editor.editor
	if (!view) return 'Error: CodeMirror view not available'

	try {
		switch (toolName) {
			case 'read_document': {
				const { fromLine, toLine, full } = args
				const isFull = full ?? true
				const doc = view.state.doc

				// Helper: format content with line numbers for LLM reference
				const withLineNumbers = (startLine: number, endLine: number): string => {
					const lines: string[] = []
					for (let i = startLine; i <= endLine; i++) {
						const lineNum = String(i).padStart(4, ' ')
						lines.push(`${lineNum} | ${doc.line(i).text}`)
					}
					return lines.join('\n')
				}

				if (isFull) {
					return `[Document Content (Full)]\nTotal Lines: ${doc.lines}\n\n` + withLineNumbers(1, doc.lines)
				}

				if (fromLine !== undefined) {
					const startLine = Math.max(1, fromLine)
					const endLine = toLine !== undefined ? Math.min(doc.lines, toLine) : Math.min(doc.lines, startLine + 100)

					return `[Document Slice: Lines ${startLine} to ${endLine}]\nTotal Lines: ${doc.lines}\n\n` + withLineNumbers(startLine, endLine)
				}

				// Default preview: first 50 lines with line numbers
				const previewEnd = Math.min(doc.lines, 50)
				return `[Document Preview: First 50 Lines]\nTotal Lines: ${doc.lines}\nNote: Use fromLine/toLine or full=true for more.\n\n` + withLineNumbers(1, previewEnd)
			}

			case 'get_sections': {
				const docText = view.state.doc.toString()
				const sectionRegex = /^\\(?:sub)*section\{([^}]+)\}/gm
				const sections: Array<{ text: string; level: number; line: number }> = []
				let match: RegExpExecArray | null

				while ((match = sectionRegex.exec(docText)) !== null) {
					const textBeforeMatch = docText.slice(0, match.index)
					const line = textBeforeMatch.split('\n').length
					const command = match[0].match(/^\\((?:sub)*)section/)?.[1] ?? ''
					const level = 1 + Math.floor(command.length / 3)

					sections.push({
						text: match[1],
						level,
						line,
					})
				}

				return JSON.stringify({
					sections,
					totalSections: sections.length,
				})
			}

			case 'get_document_stats': {
				const docText = view.state.doc.toString()
				const words = docText.trim().length === 0 ? 0 : docText.trim().split(/\s+/).length
				const readingTimeMinutes = Math.max(1, Math.ceil(words / 200))

				return JSON.stringify({
					characterCount: docText.length,
					lineCount: view.state.doc.lines,
					wordCount: words,
					estimatedReadingTimeMinutes: readingTimeMinutes,
				})
			}

			case 'search_text_lines': {
				const { query, caseSensitive } = args
				const doc = view.state.doc
				const results: { line: number; text: string }[] = []
				const searchString = caseSensitive ? query : query.toLowerCase()

				for (let i = 1; i <= doc.lines; i++) {
					const lineText = doc.line(i).text
					const compareText = caseSensitive ? lineText : lineText.toLowerCase()
					if (compareText.includes(searchString)) {
						results.push({ line: i, text: lineText })
					}
				}

				let output = `[Search Results for "${query}"]\n`
				output += `Match Count: ${results.length}\n`
				if (results.length >= 50) output += `Note: Showing first 50 matches.\n`
				output += `\n` + results.map(r => `${String(r.line).padStart(4, ' ')} | ${r.text}`).join('\n')

				return output
			}

			case 'replace_lines': {
				const { fromLine, toLine, newContent, stage } = args
				const doc = view.state.doc

				if (fromLine < 1 || toLine > doc.lines || fromLine > toLine) {
					return `Error: Invalid line range ${fromLine}-${toLine}. Total lines: ${doc.lines}`
				}

				const fromPos = doc.line(fromLine).from
				const toPos = doc.line(toLine).to

				if (stage) {
					const original = doc.toString()
					const prefix = doc.sliceString(0, fromPos)
					const suffix = doc.sliceString(toPos)
					const anchored = createAnchoredReplacePair(original, fromPos, toPos, newContent)
					return {
						type: 'staged_change',
						id: createStagedChangeId(),
						createdAt: Date.now(),
						operationType: 'replace_lines',
						original,
						modified: prefix + newContent + suffix,
						searchBlock: anchored ? [anchored.search] : undefined,
						replaceBlock: anchored ? [anchored.replace] : undefined,
						description: `Replace lines ${fromLine}-${toLine}`
					}
				}

				view.dispatch({
					changes: { from: fromPos, to: toPos, insert: newContent },
					scrollIntoView: true
				})
				view.focus()
				return `Successfully replaced lines ${fromLine} to ${toLine}.`
			}

			case 'insert_content': {
				const { content, position, stage, atLine, afterText, beforeText, occurrence, caseSensitive } = args
				const selection = view.state.selection.main
				const docText = view.state.doc.toString()
				const endDocumentIndex = findLatexEndDocumentIndex(docText)
				const isSectionInsert = looksLikeLatexSectionContent(content)
				const bibliographyLimit = endDocumentIndex >= 0 ? endDocumentIndex : undefined
				const bibliographyIndex = isSectionInsert
					? findLatexBibliographyStart(docText, bibliographyLimit)
					: null
				let from = selection.from
				let to = selection.to

				if (typeof atLine === 'number') {
					if (atLine < 1 || atLine > view.state.doc.lines) {
						return `Error: Invalid atLine=${atLine}. Total lines: ${view.state.doc.lines}`
					}
					from = view.state.doc.line(atLine).from
					to = from
				} else if (typeof afterText === 'string' && afterText.length > 0) {
					const matches = findAllOccurrences(docText, afterText, caseSensitive ?? false)
					if (matches.length === 0) {
						return `Error: insert_content anchor not found (afterText). Use search_text_lines first to get exact anchor.`
					}
					if (matches.length > 1 && !occurrence) {
						return `Error: insert_content anchor ambiguous (${matches.length} matches). Use search_text_lines to disambiguate, then pass occurrence.`
					}
					const occurrenceIndex = Math.max(1, occurrence ?? 1)
					if (occurrenceIndex > matches.length) {
						return `Error: occurrence=${occurrenceIndex} out of range. Found ${matches.length} anchor matches.`
					}
					const startIndex = matches[occurrenceIndex - 1]
					from = startIndex + afterText.length
					to = from
				} else if (typeof beforeText === 'string' && beforeText.length > 0) {
					const matches = findAllOccurrences(docText, beforeText, caseSensitive ?? false)
					if (matches.length === 0) {
						return `Error: insert_content anchor not found (beforeText). Use search_text_lines first to get exact anchor.`
					}
					if (matches.length > 1 && !occurrence) {
						return `Error: insert_content anchor ambiguous (${matches.length} matches). Use search_text_lines to disambiguate, then pass occurrence.`
					}
					const occurrenceIndex = Math.max(1, occurrence ?? 1)
					if (occurrenceIndex > matches.length) {
						return `Error: occurrence=${occurrenceIndex} out of range. Found ${matches.length} anchor matches.`
					}
					from = matches[occurrenceIndex - 1]
					to = from
				} else if (position === 'start') {
					from = 0
					to = 0
				} else if (position === 'end') {
					if (bibliographyIndex !== null) {
						from = bibliographyIndex
						to = bibliographyIndex
					} else if (endDocumentIndex >= 0) {
						from = endDocumentIndex
						to = endDocumentIndex
					} else {
						from = view.state.doc.length
						to = view.state.doc.length
					}
				}

				if (isSectionInsert) {
					if (endDocumentIndex >= 0 && from > endDocumentIndex) {
						const endDocumentMarker = String.raw`\end{document}`
						return `Error: invalid section placement. New section cannot be inserted after ${endDocumentMarker}. Use get_sections + search_text_lines and insert before bibliography/references or before ${endDocumentMarker}.`
					}

					if (bibliographyIndex !== null && from > bibliographyIndex) {
						return 'Error: invalid section placement. New section cannot be inserted after bibliography/references. Use get_sections + search_text_lines, then insert before bibliography marker.'
					}
				}

				if (stage) {
					const prefix = view.state.doc.sliceString(0, from)
					const suffix = view.state.doc.sliceString(to)
					const anchored = createAnchoredReplacePair(docText, from, to, content)
					let insertionLabel = position || 'cursor'
					if (typeof atLine === 'number') {
						insertionLabel = `line ${atLine}`
					} else if (typeof afterText === 'string' && afterText.length > 0) {
						insertionLabel = 'afterText anchor'
					} else if (typeof beforeText === 'string' && beforeText.length > 0) {
						insertionLabel = 'beforeText anchor'
					}
					return {
						type: 'staged_change',
						id: createStagedChangeId(),
						createdAt: Date.now(),
						operationType: 'insert_content',
						original: docText,
						modified: prefix + content + suffix,
						searchBlock: anchored ? [anchored.search] : undefined,
						replaceBlock: anchored ? [anchored.replace] : undefined,
						description: `Insert content at ${insertionLabel}`
					}
				}

				view.dispatch({
					changes: { from, to, insert: content },
					selection: { anchor: from + content.length },
					scrollIntoView: true
				})
				view.focus()
				return `Inserted content at ${position || 'cursor'}`
			}

			case 'apply_diff_edit': {
				const { stage } = args
				const parsed = parseApplyDiffPairs(args)
				if (!parsed.pairs) {
					return parsed.error
				}

				const docText = view.state.doc.toString()
				const resolved = findAtomicDiffMatches(docText, parsed.pairs)
				if (!resolved.matches) {
					return resolved.error
				}

				const matches = resolved.matches
				const modified = applyMatchesToText(docText, matches)
				const sortedDesc = [...matches].sort((a, b) => b.from - a.from)

				if (stage) {
					const isBatch = parsed.pairs.length > 1
					return {
						type: 'staged_change',
						id: createStagedChangeId(),
						createdAt: Date.now(),
						operationType: 'apply_diff_edit',
						original: docText,
						modified,
						searchBlock: parsed.pairs.map(pair => pair.search),
						replaceBlock: parsed.pairs.map(pair => pair.replace),
						description: isBatch
							? `Apply diff edit (batch ${parsed.pairs.length} items)`
							: 'Apply diff edit'
					}
				}

				view.dispatch({
					changes: sortedDesc.map(match => ({ from: match.from, to: match.to, insert: match.replace })),
					scrollIntoView: true
				})
				view.focus()
				return parsed.pairs.length > 1
					? `Successfully applied batch patch (${parsed.pairs.length} items).`
					: `Successfully applied patch.`
			}

			case 'compile_latex': {
				if (typeof editor.handleCompile === 'function') {
					await editor.handleCompile()
					return 'Compilation triggered. Check logs if you need details on errors.'
				}
				return 'Error: compile_latex is not supported by this editor instance.'
			}

			case 'get_compile_logs': {
				if (editor.compileResult?.log) {
					return editor.compileResult.log
				}
				return 'No compilation logs found. Try calling compile_latex first.'
			}

			default:
				return `Tool "${toolName}" is not yet available for LaTeX editor. Supported tools: read_document, get_sections, search_text_lines, replace_lines, insert_content, apply_diff_edit, compile_latex, get_compile_logs.`
		}
	} catch (e) {
		return `Error in CodeMirror tool execution: ${e instanceof Error ? e.message : 'Unknown error'}`
	}
}

