import assert from 'node:assert/strict'
import test from 'node:test'

import { executeEditorTool } from '../tools/functions'

const createMockEditor = (initialText: string) => {
	let docText = initialText

	const view = {
		state: {
			doc: {
				toString: () => docText,
				get length() {
					return docText.length
				},
				get lines() {
					return docText.split('\n').length
				},
				line: (lineNumber: number) => {
					const lines = docText.split('\n')
					const text = lines[lineNumber - 1] ?? ''
					let cursor = 0
					for (let i = 0; i < lineNumber - 1; i++) cursor += (lines[i]?.length ?? 0) + 1
					return {
						text,
						from: cursor,
						to: cursor + text.length,
					}
				},
				sliceString: (from: number, to: number) => docText.slice(from, to),
			},
			selection: {
				main: { from: 0, to: 0 },
			},
		},
		dispatch: ({ changes }: { changes: Array<{ from: number; to: number; insert: string }> | { from: number; to: number; insert: string } }) => {
			if (Array.isArray(changes)) {
				let next = docText
				for (const change of changes) {
					next = next.slice(0, change.from) + change.insert + next.slice(change.to)
				}
				docText = next
				return
			}

			docText = docText.slice(0, changes.from) + changes.insert + docText.slice(changes.to)
		},
		focus: () => undefined,
	}

	return {
		editor: view,
		getText: () => docText,
	}
}

test('apply_diff_edit replaces multiple sections by index', async () => {
	const editor = createMockEditor('A1\nB1\n---\nA2\nB2')

	const result = await executeEditorTool(editor, 'apply_diff_edit', {
		searchBlock: ['A1\nB1', 'A2\nB2'],
		replaceBlock: ['R1', 'R2'],
	})

	assert.equal(result, 'Successfully applied batch patch (2 items).')
	assert.equal(editor.getText(), 'R1\n---\nR2')
})

test('apply_diff_edit fails when array lengths mismatch', async () => {
	const editor = createMockEditor('Satu')

	const result = await executeEditorTool(editor, 'apply_diff_edit', {
		searchBlock: ['Satu', 'Dua'],
		replaceBlock: ['One'],
	})

	assert.equal(
		result,
		'Error: apply_diff_edit requires equal length arrays. searchBlock.length=2, replaceBlock.length=1.'
	)
})

test('apply_diff_edit is atomic when one index fails', async () => {
	const editor = createMockEditor('Paragraf 1\nParagraf 2')

	const result = await executeEditorTool(editor, 'apply_diff_edit', {
		searchBlock: ['Paragraf 1', 'Tidak Ada'],
		replaceBlock: ['Ganti 1', 'Ganti 2'],
	})

	assert.equal(
		result,
		'error: apply_diff_edit FAILED at index 1 — search text not found.\nreason: searchBlock[1] does not exist exactly in document.\ninstructions: Use search_text_lines and replace_lines for this block, then retry batch if needed.'
	)
	assert.equal(editor.getText(), 'Paragraf 1\nParagraf 2')
})
