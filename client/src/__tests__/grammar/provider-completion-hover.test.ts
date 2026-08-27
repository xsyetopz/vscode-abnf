import { beforeAll, describe, expect, test } from "bun:test";
import { PositionMock } from "../vscode-mock.ts";
import {
	asTextDocument,
	createDocument,
	createWorkspace,
	loadGrammarTestCore,
} from "./provider-test-utils.ts";

let GrammarCompletionProvider: typeof import("../../grammar/completion.ts").GrammarCompletionProvider;
let GrammarHoverProvider: typeof import("../../grammar/providers/hover.ts").GrammarHoverProvider;

function hoverValue(hover: unknown): string {
	if (!hover) {
		throw new Error("Expected hover result");
	}
	return ((hover as { contents: unknown }).contents as { value: string }).value;
}

beforeAll(async () => {
	await loadGrammarTestCore();
	({ GrammarCompletionProvider } = await import("../../grammar/completion.ts"));
	({ GrammarHoverProvider } = await import("../../grammar/providers/hover.ts"));
});

describe("grammar completion and hover providers", () => {
	test("offers workspace-aware completions and dialect snippets", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= item\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarCompletionProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= shared | local\nlocal ::= 'x'\n",
			"ebnf",
		);
		const items = provider.provideCompletionItems(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(items.some((item) => item.label === "shared")).toBe(true);
		expect(items.find((item) => item.label === "shared")?.detail).toContain(
			"(workspace)",
		);
		expect(items.some((item) => item.label === "production")).toBe(true);
		const characterRange = items.find((item) => item.label === "character range");
		if (!characterRange) {
			throw new Error("Expected character range completion");
		}
		expect((characterRange.insertText as { value: string }).value).toContain("#x");
	});

	test("shows EBNF character hover and workspace fallback hovers", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= #x20\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarHoverProvider(workspace);
		const charDoc = createDocument(
			"/workspace/char.ebnf",
			"char ::= #x20\n",
			"ebnf",
		);
		const charHover = provider.provideHover(
			asTextDocument(charDoc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(hoverValue(charHover)).toContain("not a rule reference");

		const refDoc = createDocument(
			"/workspace/root.ebnf",
			"root ::= shared\n",
			"ebnf",
		);
		const ruleHover = provider.provideHover(
			asTextDocument(refDoc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(hoverValue(ruleHover)).toContain("shared ::= #x20");
	});

	test("shows built-in ABNF core-rule hover with workspace reference count", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/other.abnf",
				text: "other = ALPHA\n",
				dialect: "abnf",
			},
		]);
		const provider = new GrammarHoverProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			"root = ALPHA\n",
			"abnf",
		);
		const hover = provider.provideHover(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{} as never,
		);
		const text = hoverValue(hover);

		expect(text).toContain("Built-in ABNF core rule from RFC 5234 Appendix B.");
		expect(text).toContain("References: 2");
		expect(text).toContain("ALPHA = %x41-5A / %x61-7A");
	});

	test("prefers local ABNF rules over core-rule fallback", () => {
		const workspace = createWorkspace();
		const provider = new GrammarHoverProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			'root = ALPHA\nALPHA = "x"\n',
			"abnf",
		);
		const hover = provider.provideHover(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{} as never,
		);
		const text = hoverValue(hover);

		expect(text).toContain('ALPHA = "x"');
		expect(text).not.toContain("Built-in ABNF core rule.");
		expect(text).not.toContain("Not user-defined.");
	});
});
