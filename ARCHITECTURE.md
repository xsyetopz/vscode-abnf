# Architecture

`vscode-bnf-intellisense` is a VS Code extension for ABNF, BNF, W3C XML EBNF,
and RBNF files. The extension ships TextMate grammars and TypeScript providers
for navigation, diagnostics, formatting, semantic highlighting, inlay hints, and
symbol search.

## Runtime Shape

- Bun runs development commands, tests, and the build.
- The extension entrypoint is `client/src/main.ts`.
- `client/src/extension.ts` activates the extension and registers providers.
- `dist/extension.js` is the bundled VS Code runtime artifact produced by
  `bun run build`.

## Modules

### ABNF Core

`client/src/abnf/` contains ABNF-only logic:

- `tokenizer.ts` scans RFC 5234/RFC 7405 syntax.
- `parser.ts` builds ABNF document items.
- `core-rules.ts` defines standard ABNF core rules.
- `format.ts` and `format-renderer.ts` format ABNF documents.
- `types.ts` defines shared ABNF model types.

### Shared Grammar Engine

`client/src/grammar/` handles behavior shared by `.abnf`, `.bnf`, `.ebnf`, and
`.rbnf` files:

- `dialects.ts` and `standards.ts` define supported dialect metadata.
- `tokenizer.ts`, `parser.ts`, and `syntax-details.ts` parse production grammars.
- `symbol-table.ts` and `workspace.ts` index rule definitions and references.
- `diagnostics.ts`, `semantic-tokens.ts`, `completion.ts`, `code-actions.ts`,
  `format.ts`, and `formatting-provider.ts` implement editor behavior.
- `config.ts` is the shared settings reader for the `bnf.*` namespace.

### VS Code Providers

`client/src/grammar/providers/` contains hover, definition, references, rename,
document symbols, workspace symbols, highlights, folding, and inlay hints.
`providers/index.ts` registers those providers.

### VS Code Assets

- `syntaxes/*.tmLanguage.json` provides TextMate highlighting and markdown code
  block injections.
- `snippets/*.json` provides grammar snippets.
- `bnf-language-configuration.json` configures brackets, comments, and editor
  behavior for grammar languages.
- `examples/json.*` gives equivalent sample grammars across supported dialects.

## Invariants

- All dialects use `bnf.*` settings.
- ABNF core rules resolve as built-ins, not ordinary workspace definitions.
- RBNF angle-bracket rule names may contain spaces and still represent one symbol.
- W3C XML EBNF character classes and exclusions must not be treated as rule
  references.
- ISO/IEC 14977 EBNF is not supported.
- TextMate grammar files stay JSON so VS Code can consume them directly.

## Test Map

- `client/src/__tests__/abnf-format.test.ts` covers ABNF formatting.
- `client/src/__tests__/grammar/*.test.ts` covers parser, tokenizer, diagnostics,
  formatting, syntax details, standards, providers, and TextMate grammar behavior.
- `client/src/__tests__/vscode-mock.ts` supplies the local VS Code API mock.

## Change Guide

- Parser or tokenizer changes need fixture-like examples in tests.
- Provider changes should use the focused provider tests and shared test utilities.
- Formatting changes should cover both output text and grammar-safe preservation.
- Settings changes must update `package.json`, README settings docs, and tests.
