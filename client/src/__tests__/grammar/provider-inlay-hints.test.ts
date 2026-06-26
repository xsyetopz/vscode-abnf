import { beforeAll, describe, expect, test } from "bun:test";
import {
	RangeMock,
	resetConfigurationValues,
	setConfigurationValue,
} from "../vscode-mock.ts";
import {
	asTextDocument,
	createDocument,
	createWorkspace,
	loadGrammarTestCore,
} from "./provider-test-utils.ts";

let GrammarInlayHintsProvider: typeof import("../../grammar/providers/inlay-hints.ts").GrammarInlayHintsProvider;

beforeAll(async () => {
	await loadGrammarTestCore();
	({ GrammarInlayHintsProvider } = await import(
		"../../grammar/providers/inlay-hints.ts"
	));
});

describe("grammar inlay hints provider", () => {
	test("shows provider-level syntax inlays only when enabled", () => {
		resetConfigurationValues();
		const workspace = createWorkspace();
		const provider = new GrammarInlayHintsProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			'root = %x41-5A / %i"abc"\n',
			"abnf",
		);
		const range = new RangeMock(0, 0, 0, 24);

		expect(
			provider.provideInlayHints(
				asTextDocument(doc),
				range as never,
				{} as never,
			),
		).toHaveLength(0);

		setConfigurationValue("bnf.inlayHints.syntaxDetails", true);
		const hints = provider.provideInlayHints(
			asTextDocument(doc),
			range as never,
			{} as never,
		) as Array<{ label: string }>;

		expect(hints).toHaveLength(1);
		expect(hints[0]?.label ?? "").toContain("range");
		expect(hints[0]?.label ?? "").toContain("case-insensitive");
		resetConfigurationValues();
	});

	test("combines metadata and syntax-detail inlays on one rule line", () => {
		resetConfigurationValues();
		setConfigurationValue("bnf.inlayHints.syntaxDetails", true);
		setConfigurationValue("bnf.inlayHints.referenceCount", true);
		const workspace = createWorkspace();
		const provider = new GrammarInlayHintsProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			"root = 1*2ALPHA root\n",
			"abnf",
		);
		const hints = provider.provideInlayHints(
			asTextDocument(doc),
			new RangeMock(0, 0, 0, 20) as never,
			{} as never,
		) as Array<{ label: string }>;

		expect(hints).toHaveLength(2);
		expect(hints.some((hint) => hint.label.includes("1 ref"))).toBe(true);
		expect(hints.some((hint) => hint.label.includes("repetition"))).toBe(true);
		resetConfigurationValues();
	});
});
