import { tokenize as tokenizeAbnf } from "../abnf/tokenizer.ts";
import { AbnfTokenKind } from "../abnf/types.ts";
import type { GrammarDialect } from "./dialects.ts";

/**
 * Token categories used by cross-dialect grammar services.
 */
export type GrammarTokenKind =
	| "ruleName"
	| "reference"
	| "assignment"
	| "alternative"
	| "literal"
	| "number"
	| "comment"
	| "group"
	| "repeat"
	| "charCode"
	| "charClass"
	| "unknown";

/**
 * Cross-dialect token with source text and range metadata.
 */
export interface GrammarToken {
	kind: GrammarTokenKind;
	text: string;
	line: number;
	column: number;
}

const PRODUCTION_RE =
	/^\s*(?:\[[^\]\r\n]+\]\s*)?(<[^<>\r\n]+>|[A-Za-z_][A-Za-z0-9_.:-]*)\s*(::=)/;
const EBNF_PRODUCTION_NUMBER_RE = /^\s*(\[[^\]\r\n]+\])(?=\s*[A-Za-z_])/;
const ANGLE_RE = /<[^<>\r\n]+>/g;
const BARE_RE = /\b[A-Za-z_][A-Za-z0-9_.:-]*\b/g;
const LITERAL_RE = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
const EBNF_CHAR_CLASS_RE = /\[(?:\^)?[^\]\r\n]*\]/g;
const EBNF_CHAR_CODE_RE = /#x[0-9A-Fa-f]+/g;
const LINE_SPLIT_RE = /\r\n|\n|\r/;

interface CommentRange {
	start: number;
	end: number;
}

/**
 * Tokenizes a document according to its grammar dialect.
 */
export function tokenizeGrammar(
	text: string,
	dialect: GrammarDialect,
): GrammarToken[] {
	return dialect === "abnf"
		? tokenizeAbnfGrammar(text)
		: tokenizeProductionGrammar(text, dialect);
}

function tokenizeAbnfGrammar(text: string): GrammarToken[] {
	return tokenizeAbnf(text).flatMap((token) => {
		const kind = abnfKind(token.kind);
		return kind
			? [{ kind, text: token.text, line: token.line, column: token.column }]
			: [];
	});
}

function abnfKind(kind: AbnfTokenKind): GrammarTokenKind | undefined {
	switch (kind) {
		case AbnfTokenKind.Rulename:
			return "reference";
		case AbnfTokenKind.DefinedAs:
		case AbnfTokenKind.IncrementalAs:
			return "assignment";
		case AbnfTokenKind.Alternation:
			return "alternative";
		case AbnfTokenKind.String:
		case AbnfTokenKind.CaseSensitiveString:
		case AbnfTokenKind.CaseInsensitiveString:
		case AbnfTokenKind.ProseValue:
			return "literal";
		case AbnfTokenKind.NumericValue:
			return "charCode";
		case AbnfTokenKind.Integer:
			return "number";
		case AbnfTokenKind.Comment:
			return "comment";
		case AbnfTokenKind.ParenOpen:
		case AbnfTokenKind.ParenClose:
		case AbnfTokenKind.BracketOpen:
		case AbnfTokenKind.BracketClose:
			return "group";
		case AbnfTokenKind.Asterisk:
			return "repeat";
		case AbnfTokenKind.Unknown:
			return "unknown";
		default:
			return undefined;
	}
}

function tokenizeProductionGrammar(
	text: string,
	dialect: Exclude<GrammarDialect, "abnf">,
): GrammarToken[] {
	const lines = text.split(LINE_SPLIT_RE);
	const lineStarts = lineStartOffsets(text, lines);
	const comments = productionCommentRanges(text, dialect);
	return lines
		.flatMap((line, lineNumber) =>
			tokenizeProductionLine(
				line,
				lineNumber,
				dialect,
				lineStarts[lineNumber] ?? 0,
				comments,
			),
		)
		.sort((a, b) => a.line - b.line || a.column - b.column);
}

function lineStartOffsets(text: string, lines: string[]): number[] {
	const starts: number[] = [];
	let offset = 0;
	for (const line of lines) {
		starts.push(offset);
		offset += line.length;
		if (text.startsWith("\r\n", offset)) {
			offset += 2;
		} else if (text[offset] === "\r" || text[offset] === "\n") {
			offset++;
		}
	}
	return starts;
}

function productionCommentRanges(
	text: string,
	dialect: Exclude<GrammarDialect, "abnf">,
): CommentRange[] {
	const ranges: CommentRange[] = [];
	let quote: string | undefined;
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (quote) {
			if (ch === "\r" || ch === "\n") {
				quote = undefined;
				i++;
				continue;
			}
			if (ch === "\\") {
				i++;
				if (text[i] !== "\r" && text[i] !== "\n") {
					i++;
				}
			} else {
				if (ch === quote) {
					quote = undefined;
				}
				i++;
			}
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			i++;
			continue;
		}
		if (dialect === "ebnf" && ch === "/" && text[i + 1] === "*") {
			const start = i;
			const close = text.indexOf("*/", i + 2);
			const end = close < 0 ? text.length : close + 2;
			ranges.push({ start, end });
			i = end;
			continue;
		}
		if (dialect !== "ebnf" && ch === ";") {
			const start = i;
			i++;
			while (i < text.length && text[i] !== "\r" && text[i] !== "\n") {
				i++;
			}
			ranges.push({ start, end: i });
			continue;
		}
		i++;
	}
	return ranges;
}

function tokenizeProductionLine(
	line: string,
	lineNumber: number,
	dialect: Exclude<GrammarDialect, "abnf">,
	lineStart: number,
	comments: readonly CommentRange[],
): GrammarToken[] {
	const commentLine = maskCommentRanges(line, lineStart, comments);
	const production = commentLine.match(PRODUCTION_RE);
	const literalLine = commentLine.replace(LITERAL_RE, maskMatch);
	const referenceLine = maskReferenceExclusions(literalLine, dialect);
	return [
		...commentTokens(line, lineNumber, lineStart, comments),
		...productionNumberTokens(commentLine, lineNumber, dialect),
		...productionTokens(line, lineNumber, production),
		...literalTokens(commentLine, lineNumber),
		...ebnfCharacterTokens(commentLine, lineNumber, dialect),
		...angleReferenceTokens(referenceLine, lineNumber, production),
		...bareReferenceTokens(referenceLine, lineNumber, dialect, production),
		...operatorTokens(literalLine, lineNumber),
	];
}

function maskMatch(match: string): string {
	return " ".repeat(match.length);
}

function maskReferenceExclusions(
	line: string,
	dialect: Exclude<GrammarDialect, "abnf">,
): string {
	let out = line.replace(LITERAL_RE, maskMatch);
	if (dialect === "ebnf") {
		out = out
			.replace(EBNF_CHAR_CLASS_RE, maskMatch)
			.replace(EBNF_CHAR_CODE_RE, maskMatch);
	}
	return out;
}

function commentTokens(
	line: string,
	lineNumber: number,
	lineStart: number,
	comments: readonly CommentRange[],
): GrammarToken[] {
	const lineEnd = lineStart + line.length;
	return comments.flatMap((comment) => {
		const start = Math.max(comment.start, lineStart);
		const end = Math.min(comment.end, lineEnd);
		return start < end
			? [{
					kind: "comment" as const,
					text: line.slice(start - lineStart, end - lineStart),
					line: lineNumber,
					column: start - lineStart,
				}]
			: [];
	});
}

function maskCommentRanges(
	line: string,
	lineStart: number,
	comments: readonly CommentRange[],
): string {
	const masked = line.split("");
	for (const comment of comments) {
		const start = Math.max(comment.start - lineStart, 0);
		const end = Math.min(comment.end - lineStart, line.length);
		for (let i = start; i < end; i++) {
			masked[i] = " ";
		}
	}
	return masked.join("");
}

function productionNumberTokens(
	line: string,
	lineNumber: number,
	dialect: Exclude<GrammarDialect, "abnf">,
): GrammarToken[] {
	if (dialect !== "ebnf") {
		return [];
	}
	const match = line.match(EBNF_PRODUCTION_NUMBER_RE);
	const text = match?.[1];
	return text
		? [{ kind: "number", text, line: lineNumber, column: line.indexOf(text) }]
		: [];
}

function productionTokens(
	line: string,
	lineNumber: number,
	production: RegExpMatchArray | null,
): GrammarToken[] {
	if (!production) {
		return [];
	}
	const name = production[1] ?? "";
	const assignment = production[2] ?? "::=";
	return [
		{
			kind: "ruleName",
			text: name,
			line: lineNumber,
			column: line.indexOf(name),
		},
		{
			kind: "assignment",
			text: assignment,
			line: lineNumber,
			column: line.indexOf(assignment),
		},
	];
}

function literalTokens(line: string, lineNumber: number): GrammarToken[] {
	return Array.from(line.matchAll(LITERAL_RE), (match) => ({
		kind: "literal" as const,
		text: match[0] ?? "",
		line: lineNumber,
		column: match.index ?? 0,
	}));
}

function ebnfCharacterTokens(
	line: string,
	lineNumber: number,
	dialect: Exclude<GrammarDialect, "abnf">,
): GrammarToken[] {
	if (dialect !== "ebnf") {
		return [];
	}
	const classTokens = Array.from(
		line.matchAll(EBNF_CHAR_CLASS_RE),
		(match) => ({
			kind: "charClass" as const,
			text: match[0] ?? "",
			line: lineNumber,
			column: match.index ?? 0,
		}),
	);
	const classRanges = classTokens.map((token) => ({
		start: token.column,
		end: token.column + token.text.length,
	}));
	const codeTokens = Array.from(line.matchAll(EBNF_CHAR_CODE_RE), (match) => {
		const column = match.index ?? 0;
		return {
			kind: "charCode" as const,
			text: match[0] ?? "",
			line: lineNumber,
			column,
		};
	}).filter(
		(token) =>
			!classRanges.some(
				(range) => token.column >= range.start && token.column < range.end,
			),
	);
	return [...classTokens, ...codeTokens];
}

function angleReferenceTokens(
	line: string,
	lineNumber: number,
	production: RegExpMatchArray | null,
): GrammarToken[] {
	return Array.from(line.matchAll(ANGLE_RE), (match) => ({
		kind: "reference" as const,
		text: match[0] ?? "",
		line: lineNumber,
		column: match.index ?? 0,
	})).filter((token) => !(production && token.text === production[1]));
}

function bareReferenceTokens(
	line: string,
	lineNumber: number,
	dialect: Exclude<GrammarDialect, "abnf">,
	production: RegExpMatchArray | null,
): GrammarToken[] {
	if (dialect === "rbnf") {
		return [];
	}
	return Array.from(line.matchAll(BARE_RE), (match) => ({
		kind: "reference" as const,
		text: match[0] ?? "",
		line: lineNumber,
		column: match.index ?? 0,
	})).filter((token) => !(production && token.text === production[1]));
}

function operatorTokens(line: string, lineNumber: number): GrammarToken[] {
	return [
		...repeatedOperatorTokens(line, lineNumber, "|", "alternative"),
		...repeatedOperatorTokens(line, lineNumber, "?", "repeat"),
		...repeatedOperatorTokens(line, lineNumber, "+", "repeat"),
		...repeatedOperatorTokens(line, lineNumber, "*", "repeat"),
		...repeatedOperatorTokens(line, lineNumber, "(", "group"),
		...repeatedOperatorTokens(line, lineNumber, ")", "group"),
		...repeatedOperatorTokens(line, lineNumber, "[", "group"),
		...repeatedOperatorTokens(line, lineNumber, "]", "group"),
		...repeatedOperatorTokens(line, lineNumber, "{", "group"),
		...repeatedOperatorTokens(line, lineNumber, "}", "group"),
	];
}

function repeatedOperatorTokens(
	line: string,
	lineNumber: number,
	operator: string,
	kind: GrammarTokenKind,
): GrammarToken[] {
	const tokens: GrammarToken[] = [];
	let column = line.indexOf(operator);
	while (column >= 0) {
		tokens.push({ kind, text: operator, line: lineNumber, column });
		column = line.indexOf(operator, column + 1);
	}
	return tokens;
}
