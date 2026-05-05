import { expect, test } from "@jest/globals";

import { executeEditorTool } from "../tools/functions";

const createMockEditor = (initialText: string) => {
	let docText = initialText;

	const view = {
		state: {
			doc: {
				toString: () => docText,
				get length() {
					return docText.length;
				},
				get lines() {
					return docText.split("\n").length;
				},
				line: (lineNumber: number) => {
					const lines = docText.split("\n");
					const text = lines[lineNumber - 1] ?? "";
					let cursor = 0;
					for (let i = 0; i < lineNumber - 1; i++)
						cursor += (lines[i]?.length ?? 0) + 1;
					return {
						text,
						from: cursor,
						to: cursor + text.length,
					};
				},
				sliceString: (from: number, to: number) => docText.slice(from, to),
			},
			selection: {
				main: { from: 0, to: 0 },
			},
		},
		dispatch: ({
			changes,
		}: {
			changes:
				| Array<{ from: number; to: number; insert: string }>
				| { from: number; to: number; insert: string };
		}) => {
			if (Array.isArray(changes)) {
				let next = docText;
				for (const change of changes) {
					next =
						next.slice(0, change.from) + change.insert + next.slice(change.to);
				}
				docText = next;
				return;
			}

			docText =
				docText.slice(0, changes.from) +
				changes.insert +
				docText.slice(changes.to);
		},
		focus: () => undefined,
	};

	return {
		editor: view,
		getText: () => docText,
	};
};

test("apply_diff_edit stage mode includes batch metadata", async () => {
	const editor = createMockEditor("X1\nY1\n---\nX2\nY2");

	const result = await executeEditorTool(editor, "apply_diff_edit", {
		searchBlock: ["X1\nY1", "X2\nY2"],
		replaceBlock: ["R1", "R2"],
		stage: true,
	});

	expect(result.type).toBe("staged_change");
	expect(result.description).toBe("Apply diff edit (batch 2 items)");
	expect(result.searchBlock).toEqual(["X1\nY1", "X2\nY2"]);
	expect(result.replaceBlock).toEqual(["R1", "R2"]);
	expect(result.modified).toBe("R1\n---\nR2");
});
