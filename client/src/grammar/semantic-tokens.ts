import {
  type CancellationToken,
  type DocumentSemanticTokensProvider,
  Range,
  SemanticTokensBuilder,
  SemanticTokensLegend,
  type TextDocument,
} from "vscode";
import { CORE_RULE_NAMES } from "../abnf/core-rules.ts";
import { readGrammarConfig } from "./config.ts";
import { normalizeSymbolName } from "./grammar.ts";
import { type GrammarToken, tokenizeGrammar } from "./tokenizer.ts";
import type { GrammarWorkspace } from "./workspace.ts";

const TOKEN_TYPES = [
  "type",
  "parameter",
  "variable",
  "string",
  "comment",
  "number",
  "operator",
  "regexp",
] as const;

type SemanticHighlightingMode = "auto" | "on" | "off";

interface SemanticTokenCandidate {
  range: Range;
  tokenType: string;
  tokenModifiers: readonly string[];
  priority: number;
}

const SYMBOL_PRIORITY = 2;
const LEXICAL_PRIORITY = 1;
const DEFAULT_MAX_TOKENS = 20_000;

const TOKEN_MODIFIERS = [
  "declaration",
  "definition",
  "readonly",
  "defaultLibrary",
] as const;

/**
 * Semantic token legend used by grammar highlighting.
 */
export const GRAMMAR_SEMANTIC_TOKENS_LEGEND = new SemanticTokensLegend(
  [...TOKEN_TYPES],
  [...TOKEN_MODIFIERS],
);

/**
 * VS Code semantic token provider for grammar definitions and references.
 */
export class GrammarSemanticTokensProvider
  implements DocumentSemanticTokensProvider
{
  readonly #manager: GrammarWorkspace;

  constructor(manager: GrammarWorkspace) {
    this.#manager = manager;
  }

  provideDocumentSemanticTokens(doc: TextDocument, _token: CancellationToken) {
    const settings = semanticHighlightingSettings();
    if (settings.mode === "off") {
      return new SemanticTokensBuilder(GRAMMAR_SEMANTIC_TOKENS_LEGEND).build();
    }
    const result = this.#manager.get(doc);
    const candidates = [
      ...symbolSemanticTokenCandidates(result),
      ...lexicalSemanticTokenCandidates(doc.getText(), result.dialect),
    ];

    if (
      settings.mode === "auto" &&
      settings.maxTokens > 0 &&
      candidates.length > settings.maxTokens
    ) {
      return new SemanticTokensBuilder(GRAMMAR_SEMANTIC_TOKENS_LEGEND).build();
    }

    const builder = new SemanticTokensBuilder(GRAMMAR_SEMANTIC_TOKENS_LEGEND);
    for (const token of selectSemanticTokens(candidates)) {
      builder.push(token.range, token.tokenType, token.tokenModifiers);
    }
    return builder.build();
  }
}

type ManagerResult = ReturnType<GrammarWorkspace["get"]>;

function addCandidate(
  candidates: SemanticTokenCandidate[],
  range: Range,
  tokenType: string,
  tokenModifiers: readonly string[] = [],
  priority = LEXICAL_PRIORITY,
): void {
  if (isValidSingleLineRange(range)) {
    candidates.push({ range, tokenType, tokenModifiers, priority });
  }
}

function symbolSemanticTokenCandidates(
  result: ManagerResult,
): SemanticTokenCandidate[] {
  const candidates: SemanticTokenCandidate[] = [];
  for (const rule of result.document.rules) {
    addCandidate(
      candidates,
      rule.nameRange,
      "type",
      ["declaration", "definition"],
      SYMBOL_PRIORITY,
    );
    for (const ref of rule.references) {
      const key = normalizeSymbolName(ref.name, result.dialect);
      if (result.dialect === "abnf" && CORE_RULE_NAMES.has(key)) {
        addCandidate(
          candidates,
          ref.range,
          "variable",
          ["readonly", "defaultLibrary"],
          SYMBOL_PRIORITY,
        );
      } else if (result.symbolTable.definitions.has(key)) {
        addCandidate(candidates, ref.range, "parameter", [], SYMBOL_PRIORITY);
      } else {
        addCandidate(candidates, ref.range, "type", [], SYMBOL_PRIORITY);
      }
    }
  }
  return candidates;
}

function lexicalSemanticTokenCandidates(
  text: string,
  dialect: ManagerResult["dialect"],
): SemanticTokenCandidate[] {
  const candidates: SemanticTokenCandidate[] = [];
  for (const token of tokenizeGrammar(text, dialect)) {
    const semantic = semanticTokenForGrammarToken(token);
    if (semantic) {
      addCandidate(
        candidates,
        tokenRange(token),
        semantic.type,
        semantic.modifiers,
      );
    }
  }
  return candidates;
}

function semanticHighlightingSettings(): {
  mode: SemanticHighlightingMode;
  maxTokens: number;
} {
  const mode = readSemanticMode(
    readGrammarConfig<unknown>("semanticHighlighting.mode", "auto"),
  );
  const maxTokens = readGrammarConfig<number>(
    "semanticHighlighting.maxTokens",
    DEFAULT_MAX_TOKENS,
  );
  return {
    mode,
    maxTokens: Number.isFinite(maxTokens) ? Math.max(0, maxTokens) : 0,
  };
}

function readSemanticMode(value: unknown): SemanticHighlightingMode {
  return value === "on" || value === "off" ? value : "auto";
}

function selectSemanticTokens(
  candidates: readonly SemanticTokenCandidate[],
): SemanticTokenCandidate[] {
  const selected: SemanticTokenCandidate[] = [];
  for (const candidate of [...candidates].sort(compareByPriority)) {
    if (
      !overlapsAny(
        candidate.range,
        selected.map((token) => token.range),
      )
    ) {
      selected.push(candidate);
    }
  }
  return selected.sort(compareByPosition);
}

function tokenRange(token: GrammarToken): Range {
  return new Range(
    token.line,
    token.column,
    token.line,
    token.column + token.text.length,
  );
}

function isValidSingleLineRange(range: Range): boolean {
  return (
    range.start.line === range.end.line &&
    range.start.character < range.end.character &&
    range.start.character >= 0 &&
    range.end.character >= 0
  );
}

function compareByPriority(
  a: SemanticTokenCandidate,
  b: SemanticTokenCandidate,
): number {
  return (
    b.priority - a.priority ||
    compareRangeStart(a.range, b.range) ||
    rangeLength(b.range) - rangeLength(a.range)
  );
}

function compareByPosition(
  a: SemanticTokenCandidate,
  b: SemanticTokenCandidate,
): number {
  return (
    compareRangeStart(a.range, b.range) ||
    a.range.end.character - b.range.end.character
  );
}

function compareRangeStart(a: Range, b: Range): number {
  return a.start.line - b.start.line || a.start.character - b.start.character;
}

function rangeLength(range: Range): number {
  return range.end.character - range.start.character;
}

function overlaps(a: Range, b: Range): boolean {
  return (
    a.start.line === b.start.line &&
    a.start.character < b.end.character &&
    b.start.character < a.end.character
  );
}

function overlapsAny(range: Range, ranges: Range[]): boolean {
  return ranges.some((candidate) => overlaps(range, candidate));
}

function semanticTokenForGrammarToken(
  token: GrammarToken,
): { type: string; modifiers?: readonly string[] } | undefined {
  switch (token.kind) {
    case "assignment":
    case "alternative":
    case "repeat":
    case "group":
      return { type: "operator" };
    case "literal":
      return { type: "string" };
    case "comment":
      return { type: "comment" };
    case "number":
    case "charCode":
      return { type: "number" };
    case "charClass":
      return { type: "regexp" };
    default:
      return undefined;
  }
}
