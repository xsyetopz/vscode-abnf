import { describe, expect, test } from "bun:test";
import { tokenizeGrammar } from "../../grammar/tokenizer.ts";

describe("grammar tokenizer", () => {
	test("tokenizes ABNF-specific forms", () => {
		const tokens = tokenizeGrammar('rule =/ %x41 / %s"A"\n', "abnf");
		expect(
			tokens.some(
				(token) => token.kind === "assignment" && token.text === "=/",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "charCode" && token.text === "%x41",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "literal" && token.text === '%s"A"',
			),
		).toBe(true);
	});

	test("tokenizes EBNF production decorations", () => {
		const tokens = tokenizeGrammar(
			"[1] value ::= string? /* note */\n",
			"ebnf",
		);
		expect(
			tokens.some(
				(token) => token.kind === "ruleName" && token.text === "value",
			),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "assignment" && token.text === "::=",
			),
		).toBe(true);
		expect(
			tokens.some((token) => token.kind === "repeat" && token.text === "?"),
		).toBe(true);
	});

	test("does not tokenize W3C EBNF character literals as references", () => {
		const tokens = tokenizeGrammar(
			"unescaped ::= [#x20-#x21] | [a-zA-Z] | [^#x0-#x8] | real\n",
			"ebnf",
		);
		const references = tokens
			.filter((token) => token.kind === "reference")
			.map((token) => token.text);

		expect(references).toContain("real");
		expect(references).not.toContain("x20");
		expect(references).not.toContain("a-zA-Z");
	});

	test("tokenizes production comments, numbers, and EBNF character syntax", () => {
		const tokens = tokenizeGrammar(
			"/* note */\n[1] char ::= [#x20-#x21] | #xA ; trailing\n",
			"ebnf",
		);

		expect(tokens.some((token) => token.kind === "comment")).toBe(true);
		expect(
			tokens.some((token) => token.kind === "number" && token.text === "[1]"),
		).toBe(true);
		expect(
			tokens.some(
				(token) => token.kind === "charClass" && token.text === "[#x20-#x21]",
			),
		).toBe(true);
		expect(
			tokens.some((token) => token.kind === "charCode" && token.text === "#xA"),
		).toBe(true);
	});

	test("keeps RBNF spaced name atomic", () => {
		const tokens = tokenizeGrammar(
			"<WF flow descriptor> ::= <FLOWSPEC>\n",
			"rbnf",
		);
		expect(tokens.find((token) => token.kind === "ruleName")?.text).toBe(
			"<WF flow descriptor>",
		);
	});

	test("does not tokenize syntax characters inside comments for every dialect", () => {
		const samples = [
			["abnf", "root = (foo) / bar ; comment ( ) | * [x]"] as const,
			["bnf", "root ::= (foo) | bar ; comment ( ) | * [x]"] as const,
			["ebnf", "root ::= (foo) /* comment ( ) | * [x] */ | bar"] as const,
			["rbnf", "<root> ::= (foo) | bar ; comment ( ) | * [x]"] as const,
		];

		for (const [dialect, text] of samples) {
			const tokens = tokenizeGrammar(text, dialect);
			const comments = tokens.filter((token) => token.kind === "comment");
			expect(comments.length).toBeGreaterThan(0);
			expect(tokens.some((token) => token.kind === "group" && token.text === "(")).toBe(
				true,
			);
			expect(tokens.some((token) => token.kind === "alternative")).toBe(true);
			for (const token of tokens.filter((token) => token.kind !== "comment")) {
				expect(
					comments.some(
						(comment) =>
							comment.line === token.line &&
							token.column < comment.column + comment.text.length &&
							comment.column < token.column + token.text.length,
					),
				).toBe(false);
			}
		}
	});

	test("recognizes comments only outside quoted literals", () => {
		const samples = [
			["abnf", 'root = ";" / bar ; trailing'] as const,
			["bnf", 'root ::= ";" | bar ; trailing'] as const,
			["ebnf", 'root ::= ";" | bar'] as const,
			["rbnf", "<root> ::= ';' | bar ; trailing"] as const,
		];

		for (const [dialect, text] of samples) {
			const tokens = tokenizeGrammar(text, dialect);
			expect(tokens.some((token) => token.kind === "literal" && token.text.includes(";"))).toBe(
				true,
			);
			if (dialect === "ebnf") {
				expect(tokens.some((token) => token.kind === "comment")).toBe(false);
			} else {
				expect(tokens.filter((token) => token.kind === "comment")).toHaveLength(1);
			}
		}
	});

	test("does not let a semicolon inside an EBNF block comment hide later syntax", () => {
		const tokens = tokenizeGrammar(
			"root ::= foo /* comment ; inside */ | bar",
			"ebnf",
		);
		const comment = tokens.find((token) => token.kind === "comment");
		expect(comment?.text).toBe("/* comment ; inside */");
		expect(tokens.some((token) => token.kind === "alternative" && token.text === "|")).toBe(
			true,
		);
		expect(tokens.some((token) => token.kind === "reference" && token.text === "bar")).toBe(
			true,
		);
	});

	test("resets unterminated literal state at newlines before later comments", () => {
		const cases = [
			[
				"bnf",
				'root ::= "unterminated\\\n; comment ()|*[]{}\nnext ::= bar',
			] as const,
			[
				"rbnf",
				"<root> ::= 'unterminated\\\n; comment ()|*[]{}\n<next> ::= bar",
			] as const,
			[
				"ebnf",
				"root ::= \"unterminated\n/* comment ()|*[]{} */ | bar",
			] as const,
		];

		for (const [dialect, text] of cases) {
			const tokens = tokenizeGrammar(text, dialect);
			const comments = tokens.filter((token) => token.kind === "comment");
			expect(comments.length).toBeGreaterThan(0);
			for (const token of tokens.filter((token) => token.kind !== "comment")) {
				expect(
					comments.some(
						(comment) =>
							comment.line === token.line &&
							token.column < comment.column + comment.text.length &&
							comment.column < token.column + token.text.length,
					),
				).toBe(false);
			}
		}
	});

	test("does not treat W3C EBNF semicolons as line comments", () => {
		const tokens = tokenizeGrammar("root ::= foo ; not a comment | bar", "ebnf");
		expect(tokens.some((token) => token.kind === "comment")).toBe(false);
		expect(tokens.some((token) => token.kind === "alternative" && token.text === "|")).toBe(
			true,
		);
		expect(tokens.some((token) => token.kind === "reference" && token.text === "bar")).toBe(
			true,
		);
	});

	test("masks multiline W3C EBNF block comments", () => {
		const tokens = tokenizeGrammar(
			"root ::= foo /* comment ( |\n[1] hidden ::= fake ) * [x] */ | bar\n",
			"ebnf",
		);
		const comments = tokens.filter((token) => token.kind === "comment");
		expect(comments).toHaveLength(2);
		for (const token of tokens.filter((candidate) => candidate.kind !== "comment")) {
			expect(
				comments.some(
					(comment) =>
						comment.line === token.line &&
						token.column < comment.column + comment.text.length &&
						comment.column < token.column + token.text.length,
				),
			).toBe(false);
		}
		expect(tokens.some((token) => token.kind === "ruleName" && token.text === "hidden")).toBe(
			false,
		);
		expect(tokens.some((token) => token.kind === "reference" && token.text === "bar")).toBe(
			true,
		);
	});
});
