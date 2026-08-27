import { beforeAll, describe, expect, test } from "bun:test";
import { PositionMock } from "../vscode-mock.ts";
import {
  asTextDocument,
  createDocument,
  createWorkspace,
  loadGrammarTestCore,
} from "./provider-test-utils.ts";

let GrammarDefinitionProvider: typeof import("../../grammar/providers/definition.ts").GrammarDefinitionProvider;
let GrammarDocumentHighlightProvider: typeof import("../../grammar/providers/highlighting.ts").GrammarDocumentHighlightProvider;
let GrammarReferenceProvider: typeof import("../../grammar/providers/references.ts").GrammarReferenceProvider;

beforeAll(async () => {
  await loadGrammarTestCore();
  ({ GrammarDefinitionProvider } = await import(
    "../../grammar/providers/definition.ts"
  ));
  ({ GrammarDocumentHighlightProvider } = await import(
    "../../grammar/providers/highlighting.ts"
  ));
  ({ GrammarReferenceProvider } = await import(
    "../../grammar/providers/references.ts"
  ));
});

describe("grammar navigation providers", () => {
  test("navigates built-in ABNF core-rule definitions and references", () => {
    const workspace = createWorkspace([
      {
        path: "/workspace/other.abnf",
        text: "other = ALPHA\n",
        dialect: "abnf",
      },
    ]);
    const definitionProvider = new GrammarDefinitionProvider(workspace);
    const referenceProvider = new GrammarReferenceProvider(workspace);
    const doc = createDocument(
      "/workspace/main.abnf",
      "root = ALPHA\n",
      "abnf",
    );

    const definitions = definitionProvider.provideDefinition(
      asTextDocument(doc),
      new PositionMock(0, 8) as never,
      {} as never,
    ) as Array<{ uri: { toString(): string } }>;
    const references = referenceProvider.provideReferences(
      asTextDocument(doc),
      new PositionMock(0, 8) as never,
      { includeDeclaration: true } as never,
      {} as never,
    ) as Array<{ uri: { toString(): string } }>;

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.uri.toString()).toContain("bnf-core:");
    expect(references).toHaveLength(3);
    expect(references[0]?.uri.toString()).toContain("bnf-core:");
  });

  test("collects references across files and can omit declarations", () => {
    const workspace = createWorkspace([
      {
        path: "/workspace/other.ebnf",
        text: "entry ::= shared\n",
        dialect: "ebnf",
      },
    ]);
    const provider = new GrammarReferenceProvider(workspace);
    const doc = createDocument(
      "/workspace/main.ebnf",
      "root ::= shared\nshared ::= item\n",
      "ebnf",
    );

    const withDeclarations = provider.provideReferences(
      asTextDocument(doc),
      new PositionMock(0, 10) as never,
      { includeDeclaration: true } as never,
      {} as never,
    );
    const withoutDeclarations = provider.provideReferences(
      asTextDocument(doc),
      new PositionMock(0, 10) as never,
      { includeDeclaration: false } as never,
      {} as never,
    );

    expect(withDeclarations).toHaveLength(3);
    expect(withoutDeclarations).toHaveLength(2);
  });

  test("finds workspace definitions but keeps highlights document-local", () => {
    const workspace = createWorkspace([
      {
        path: "/workspace/shared.ebnf",
        text: "shared ::= item\n",
        dialect: "ebnf",
      },
    ]);
    const definitionProvider = new GrammarDefinitionProvider(workspace);
    const highlightProvider = new GrammarDocumentHighlightProvider(workspace);
    const doc = createDocument(
      "/workspace/main.ebnf",
      "root ::= shared\n",
      "ebnf",
    );

    const definitions = definitionProvider.provideDefinition(
      asTextDocument(doc),
      new PositionMock(0, 10) as never,
      {} as never,
    ) as Array<{ uri: { toString(): string } }>;
    const highlights = highlightProvider.provideDocumentHighlights(
      asTextDocument(doc),
      new PositionMock(0, 10) as never,
      {} as never,
    ) as Array<{ kind: number }>;

    expect(definitions).toHaveLength(1);
    expect(definitions[0]?.uri.toString()).toBe(
      "file:///workspace/shared.ebnf",
    );
    expect(highlights).toHaveLength(1);
  });
});
