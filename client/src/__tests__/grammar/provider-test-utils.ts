import type { TextDocument } from "vscode";
import type { GrammarDialect } from "../../grammar/dialects.ts";
import type { GrammarWorkspace } from "../../grammar/workspace.ts";
import { PositionMock, RangeMock } from "../vscode-mock.ts";
import "../vscode-mock.ts";

let buildGrammarSymbolTable: typeof import("../../grammar/grammar.ts").buildGrammarSymbolTable;
let parseGrammar: typeof import("../../grammar/grammar.ts").parseGrammar;

type MockUri = {
  path: string;
  toString(): string;
};

export class DocumentMock {
  readonly uri: MockUri;
  readonly version = 1;
  readonly languageId: GrammarDialect;
  readonly lineCount: number;
  readonly fileName: string;
  readonly isUntitled = false;
  readonly encoding = "utf-8";
  readonly isDirty = false;
  readonly isClosed = false;
  readonly eol = 1;
  readonly save = async () => true;
  readonly validateRange = (range: RangeMock) => range;
  readonly validatePosition = (position: PositionMock) => position;
  readonly #text: string;
  readonly #lines: string[];
  readonly #lineOffsets: number[];

  constructor(path: string, text: string, languageId: GrammarDialect) {
    this.uri = {
      path,
      toString: () => `file://${path}`,
    };
    this.#text = text;
    this.languageId = languageId;
    this.fileName = path;
    this.#lines = text.replace(/\r\n/g, "\n").split("\n");
    this.lineCount = this.#lines.length;
    this.#lineOffsets = [];
    let offset = 0;
    for (const line of this.#lines) {
      this.#lineOffsets.push(offset);
      offset += line.length + 1;
    }
  }

  getText(range?: RangeMock): string {
    if (!range) {
      return this.#text;
    }
    return this.#text.slice(
      this.offsetAt(range.start.line, range.start.character),
      this.offsetAt(range.end.line, range.end.character),
    );
  }

  lineAt(line: number): { text: string } {
    return { text: this.#lines[line] ?? "" };
  }

  getWordRangeAtPosition(
    position: PositionMock,
    pattern: RegExp,
  ): RangeMock | undefined {
    const line = this.lineAt(position.line).text;
    for (const match of line.matchAll(new RegExp(pattern.source, "g"))) {
      const start = match.index ?? 0;
      const text = match[0] ?? "";
      const end = start + text.length;
      if (position.character >= start && position.character <= end) {
        return new RangeMock(position.line, start, position.line, end);
      }
    }
    return undefined;
  }

  positionAt(offset: number): PositionMock {
    let line = 0;
    while (
      line + 1 < this.#lineOffsets.length &&
      (this.#lineOffsets[line + 1] ?? Number.POSITIVE_INFINITY) <= offset
    ) {
      line++;
    }
    return new PositionMock(line, offset - (this.#lineOffsets[line] ?? 0));
  }

  offsetAt(line: number, character: number): number {
    return (this.#lineOffsets[line] ?? 0) + character;
  }
}

export async function loadGrammarTestCore(): Promise<void> {
  ({ buildGrammarSymbolTable, parseGrammar } = await import(
    "../../grammar/grammar.ts"
  ));
}

export function createDocument(
  path: string,
  text: string,
  languageId: GrammarDialect,
): DocumentMock {
  return new DocumentMock(path, text, languageId);
}

export function asTextDocument(doc: DocumentMock): TextDocument {
  return doc as unknown as TextDocument;
}

export function createWorkspace(
  files: Array<{ path: string; text: string; dialect: GrammarDialect }> = [],
): GrammarWorkspace {
  const indexedFiles = files.map(({ path, text, dialect }) => {
    const document = parseGrammar(text, dialect);
    return {
      uri: {
        path,
        toString: () => `file://${path}`,
      },
      dialect,
      rules: document.rules,
      symbolTable: buildGrammarSymbolTable(document, dialect),
    };
  });

  return {
    findDefinitions(name: string, dialect: GrammarDialect) {
      return indexedFiles.flatMap((file) =>
        file.dialect === dialect
          ? file.rules
              .filter((rule) => rule.name.toLowerCase() === name.toLowerCase())
              .map((rule) => ({ uri: file.uri, dialect, rule }))
          : [],
      );
    },
    get(doc: DocumentMock) {
      const dialect = doc.languageId;
      const document = parseGrammar(doc.getText(), dialect);
      return {
        dialect,
        document,
        symbolTable: buildGrammarSymbolTable(document, dialect),
      };
    },
    getAllFiles(dialect?: GrammarDialect) {
      return dialect
        ? indexedFiles.filter((file) => file.dialect === dialect)
        : indexedFiles;
    },
  } as unknown as GrammarWorkspace;
}
