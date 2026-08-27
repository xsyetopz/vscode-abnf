import { formatRule } from "./format-renderer.ts";
import { tokenize } from "./tokenizer.ts";
import type { AbnfToken } from "./types.ts";
import { AbnfTokenKind } from "./types.ts";

/**
 * ABNF alternative indentation modes.
 */
export type AbnfAlternativeIndent = "align" | "indent";
/**
 * ABNF alternative line-break modes.
 */
export type AbnfBreakAlternatives = "always" | "auto" | "never";

/**
 * Formatting options for ABNF documents.
 */
export interface AbnfFormatterConfig {
  alignEquals: boolean;
  continuationIndent: number;
  alternativeIndent: AbnfAlternativeIndent;
  insertFinalNewline: boolean;
  blankLinesBetweenRules: number;
  breakAlternatives: AbnfBreakAlternatives;
  maxLineLength: number; // 0 disables
  preserveContinuationLineBreaks: boolean;
  spaceBeforeInlineComment: number;
}

export interface RuleBlock {
  kind: "rule";
  name: string;
  operator: "=" | "=/";
  bodyTokens: AbnfToken[];
}

interface StandaloneComment {
  kind: "comment";
  text: string;
}

type DocumentItem = RuleBlock | StandaloneComment;

/**
 * Formats an ABNF document while preserving grammar structure.
 */
export function formatAbnfDocument(
  text: string,
  config: AbnfFormatterConfig,
): string {
  if (text.trim().length === 0) {
    return text;
  }

  const tokens = tokenize(text);
  const items = parseDocumentItems(tokens);
  const formatted = formatItems(items, config);

  if (config.insertFinalNewline && !formatted.endsWith("\n")) {
    return `${formatted}\n`;
  }
  return formatted;
}

interface RuleBodyCollection {
  bodyTokens: AbnfToken[];
  nextIndex: number;
}

function isNextLineRuleStart(
  tokens: AbnfToken[],
  afterNewlineIndex: number,
): boolean {
  const wsEnd = skipWhitespace(tokens, afterNewlineIndex);
  if (
    wsEnd < tokens.length &&
    tokens[wsEnd]?.kind === AbnfTokenKind.Rulename &&
    tokens[wsEnd]?.column === 0
  ) {
    const afterName = skipWhitespace(tokens, wsEnd + 1);
    if (
      afterName < tokens.length &&
      (tokens[afterName]?.kind === AbnfTokenKind.DefinedAs ||
        tokens[afterName]?.kind === AbnfTokenKind.IncrementalAs)
    ) {
      return true;
    }
  }
  return false;
}

function isRuleEndAfterComment(tokens: AbnfToken[], pos: number): boolean {
  if (pos >= tokens.length) {
    return true;
  }
  if (isNextLineRuleStart(tokens, pos)) {
    return true;
  }
  const peek = tokens[pos];
  if (peek === undefined || peek.kind === AbnfTokenKind.Newline) {
    return true;
  }
  const wsAfter = skipWhitespace(tokens, pos);
  const afterWs = tokens[wsAfter];
  if (afterWs?.kind === AbnfTokenKind.Comment && afterWs.column === 0) {
    return true;
  }
  return false;
}

function handleBodyComment(
  tokens: AbnfToken[],
  bodyTokens: AbnfToken[],
  cur: AbnfToken,
  i: number,
): { nextIndex: number; done: boolean } {
  if (cur.column === 0) {
    return { nextIndex: i, done: true };
  }
  bodyTokens.push(cur);
  let next = i + 1;
  next = consumeNewline(tokens, next);
  return { nextIndex: next, done: isRuleEndAfterComment(tokens, next) };
}

function collectRuleBody(
  tokens: AbnfToken[],
  startIndex: number,
): RuleBodyCollection {
  const bodyTokens: AbnfToken[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const cur = tokens[i];
    if (cur === undefined) {
      break;
    }

    if (cur.kind === AbnfTokenKind.Comment) {
      const result = handleBodyComment(tokens, bodyTokens, cur, i);
      i = result.nextIndex;
      if (result.done) {
        break;
      }
      continue;
    }

    if (cur.kind === AbnfTokenKind.Newline) {
      i++;
      if (isNextLineRuleStart(tokens, i)) {
        break;
      }
      bodyTokens.push(cur);
      continue;
    }

    bodyTokens.push(cur);
    i++;
  }

  return { bodyTokens, nextIndex: i };
}

interface ParseRuleResult {
  item: DocumentItem;
  nextIndex: number;
}

function parseRuleDefinition(
  tokens: AbnfToken[],
  ruleStart: number,
  ruleName: string,
): ParseRuleResult {
  let i = ruleStart + 1; // skip rulename token
  i = skipWhitespace(tokens, i);

  if (i >= tokens.length) {
    return { item: { kind: "comment", text: ruleName }, nextIndex: i };
  }

  const opTok = tokens[i];
  if (opTok === undefined) {
    return { item: { kind: "comment", text: ruleName }, nextIndex: i };
  }

  if (
    opTok.kind !== AbnfTokenKind.DefinedAs &&
    opTok.kind !== AbnfTokenKind.IncrementalAs
  ) {
    const lineText = collectLineText(tokens, ruleStart);
    return {
      item: { kind: "comment", text: lineText.text },
      nextIndex: lineText.nextIndex,
    };
  }

  const operator: "=" | "=/" =
    opTok.kind === AbnfTokenKind.IncrementalAs ? "=/" : "=";
  i++;

  const collected = collectRuleBody(tokens, i);
  return {
    item: {
      kind: "rule",
      name: ruleName,
      operator,
      bodyTokens: collected.bodyTokens,
    },
    nextIndex: collected.nextIndex,
  };
}

function parseDocumentItems(tokens: AbnfToken[]): DocumentItem[] {
  const items: DocumentItem[] = [];
  let i = 0;

  while (i < tokens.length) {
    i = skipBlankLines(tokens, i);
    if (i >= tokens.length) {
      break;
    }

    const tok = tokens[i];
    if (tok === undefined) {
      break;
    }

    if (tok.kind === AbnfTokenKind.Comment) {
      items.push({ kind: "comment", text: tok.text });
      i++;
      i = consumeNewline(tokens, i);
      continue;
    }

    if (tok.kind === AbnfTokenKind.Rulename) {
      const result = parseRuleDefinition(tokens, i, tok.text);
      items.push(result.item);
      i = result.nextIndex;
      continue;
    }

    // Skip unknown or whitespace tokens at top level
    i++;
  }

  return items;
}

function skipWhitespace(tokens: AbnfToken[], start: number): number {
  let pos = start;
  while (
    pos < tokens.length &&
    tokens[pos]?.kind === AbnfTokenKind.Whitespace
  ) {
    pos++;
  }
  return pos;
}

function skipBlankLines(tokens: AbnfToken[], start: number): number {
  let pos = start;
  while (pos < tokens.length) {
    const tok = tokens[pos];
    if (tok === undefined) {
      break;
    }
    if (tok.kind === AbnfTokenKind.Newline) {
      pos++;
      continue;
    }
    if (tok.kind === AbnfTokenKind.Whitespace) {
      pos++;
      continue;
    }
    break;
  }
  return pos;
}

function consumeNewline(tokens: AbnfToken[], start: number): number {
  if (start < tokens.length && tokens[start]?.kind === AbnfTokenKind.Newline) {
    return start + 1;
  }
  return start;
}

interface LineCollectionResult {
  text: string;
  nextIndex: number;
}

function collectLineText(
  tokens: AbnfToken[],
  start: number,
): LineCollectionResult {
  let text = "";
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === undefined || t.kind === AbnfTokenKind.Newline) {
      break;
    }
    text += t.text;
    i++;
  }
  if (i < tokens.length && tokens[i]?.kind === AbnfTokenKind.Newline) {
    i++;
  }
  return { text, nextIndex: i };
}

function formatItems(
  items: DocumentItem[],
  config: AbnfFormatterConfig,
): string {
  const groups = groupConsecutiveRules(items);
  const outputParts: string[] = [];

  for (const group of groups) {
    const groupLines = formatGroup(group, config);
    outputParts.push(groupLines);
  }

  return outputParts.join("\n");
}

type DocumentGroup = DocumentItem[];

function groupConsecutiveRules(items: DocumentItem[]): DocumentGroup[] {
  const groups: DocumentGroup[] = [];
  let currentGroup: DocumentGroup = [];

  for (const item of items) {
    if (item.kind === "comment") {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([item]);
    } else {
      currentGroup.push(item);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function calculateNameWidth(ruleBlocks: RuleBlock[]): number {
  let nameWidth = 0;
  for (const rule of ruleBlocks) {
    if (rule.name.length > nameWidth) {
      nameWidth = rule.name.length;
    }
  }
  return nameWidth;
}

function formatGroup(
  group: DocumentGroup,
  config: AbnfFormatterConfig,
): string {
  const lines: string[] = [];

  const first = group[0];
  if (group.length === 1 && first?.kind === "comment") {
    lines.push(first.text);
    return lines.join("\n");
  }

  const ruleBlocks = group.filter(
    (item): item is RuleBlock => item.kind !== "comment",
  );

  const nameWidth = config.alignEquals ? calculateNameWidth(ruleBlocks) : 0;
  const blankLines = Math.max(0, Math.floor(config.blankLinesBetweenRules));

  for (let i = 0; i < ruleBlocks.length; i++) {
    const rule = ruleBlocks[i];
    if (rule === undefined) {
      continue;
    }

    const ruleText = formatRule(rule, nameWidth, config);
    if (i > 0) {
      for (let b = 0; b < blankLines; b++) {
        lines.push("");
      }
    }
    lines.push(ruleText);
  }

  return lines.join("\n");
}
