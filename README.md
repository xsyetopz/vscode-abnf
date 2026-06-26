# vscode-bnf-intellisense

[![Stars](https://img.shields.io/github/stars/xsyetopz/vscode-bnf-intellisense?style=social)](https://github.com/xsyetopz/vscode-bnf-intellisense/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Edit ABNF, BNF, W3C XML EBNF, and RBNF files in VS Code with highlighting,
navigation, diagnostics, formatting, snippets, and rule-aware completions.

## Fast Path

Use the extension:

1. Install the extension.
2. Open an `.abnf`, `.bnf`, `.ebnf`, or `.rbnf` file.
3. Check the VS Code language mode if highlighting or diagnostics do not appear.

Work on the extension:

```bash
bun install
bun run build
```

Check changes before a PR:

```bash
bun run biome:check
bun run typecheck
bun test
bun run build
```

Build a local VSIX:

```bash
bun run package
```

## Supported Grammars

| File     | Language | Standard                                                                                                       | Supported syntax                                                                                                             |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.abnf`  | ABNF     | [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) + [RFC 7405](https://datatracker.ietf.org/doc/html/rfc7405) | Rule names, `=`, `=/`, `/`, repetitions, numeric values, prose values, and `%s`/`%i` strings.                                |
| `.bnf`   | BNF      | [W3C BNF notation](https://www.w3.org/Notation.html)                                                           | `::=` productions, alternatives, grouping, optional parts, repetitions, and literals.                                        |
| `.ebnf`  | EBNF     | [W3C XML 1.0 EBNF notation](https://www.w3.org/TR/xml/#sec-notation)                                           | Production numbers, `::=`, `?`, `+`, `*`, character classes, character exclusions, and `/* */` comments.                    |
| `.rbnf`  | RBNF     | [RFC 5511](https://datatracker.ietf.org/doc/html/rfc5511)                                                      | `::=` productions and angle-bracket rule names, including names with spaces.                                                 |

ISO/IEC 14977 EBNF is not supported. `.ebnf` files use W3C XML EBNF. ISO-style
`=` productions are reported as diagnostics.

## Editor Features

- TextMate highlighting for grammar files and Markdown code fences.
- Semantic highlighting for full rule names and references.
- Go to Definition, Find References, Rename, Hover, Document Symbols, and
  Workspace Symbols.
- Diagnostics for missing definitions, duplicate definitions, unused rules,
  empty rule bodies, and dialect-specific syntax mistakes.
- Formatting for aligned assignments, wrapped alternatives, final newlines, and
  comment spacing.
- Inlay hints for reference counts, direct recursion, unused rules, repetitions,
  terminals, and character classes.
- Snippets for common grammar constructs.

RBNF names such as `<WF flow descriptor>` stay one symbol. Rename, references,
and highlighting keep the full angle-bracket name together.

## Examples

Equivalent JSON grammars:

- [`examples/json.abnf`](examples/json.abnf)
- [`examples/json.bnf`](examples/json.bnf)
- [`examples/json.ebnf`](examples/json.ebnf)
- [`examples/json.rbnf`](examples/json.rbnf)

ABNF:

```abnf
json-text = ws value ws
value = object / array / string / number / true / false / null
object = begin-object ws [member *(ws value-separator ws member)] ws end-object
```

W3C BNF:

```bnf
<json-text> ::= <ws> <value> <ws>
<value> ::= <object> | <array> | <string> | <number> | "true" | "false" | "null"
<object> ::= "{" <ws> [<member> {<ws> "," <ws> <member>}] <ws> "}"
```

W3C XML EBNF:

```ebnf
[1] json-text ::= ws value ws
[2] value ::= object | array | string | number | "true" | "false" | "null"
[3] object ::= "{" ws (member (ws "," ws member)*)? ws "}"
```

RBNF:

```rbnf
<JSON text> ::= <WS> <value> <WS>
<value> ::= <object> | <array> | <string> | <number> | "true" | "false" | "null"
<object> ::= "{" <WS> [<member> *(<WS> "," <WS> <member>)] <WS> "}"
```

## Settings

All settings use the `bnf.*` prefix.

| Setting                                         | Default  | Effect                                                                  |
| ----------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `bnf.diagnostics.enable`                        | `true`   | Shows parser and rule diagnostics.                                      |
| `bnf.diagnostics.unusedRules`                   | `true`   | Shows hints for rules with no references.                               |
| `bnf.diagnostics.undefinedReferences`           | `true`   | Shows errors for references with no rule definition.                    |
| `bnf.formatting.alignEquals`                    | `true`   | Aligns assignment operators across consecutive rules.                   |
| `bnf.formatting.continuationIndent`             | `4`      | Sets spaces for wrapped rule-body lines.                                |
| `bnf.formatting.alternativeIndent`              | `align`  | Uses `align` or `indent` for alternatives on continuation lines.        |
| `bnf.formatting.blankLinesBetweenRules`         | `1`      | Keeps this many blank lines between rule definitions.                   |
| `bnf.formatting.breakAlternatives`              | `always` | Uses `always`, `auto`, or `never` for top-level alternatives.           |
| `bnf.formatting.maxLineLength`                  | `80`     | Wraps rule bodies after this column. Use `0` to disable wrapping.       |
| `bnf.formatting.alignProductionNumbers`         | `true`   | Aligns EBNF production numbers such as `[1]`.                           |
| `bnf.formatting.preserveCommentSpacing`         | `true`   | Keeps blank-line spacing around standalone comments.                    |
| `bnf.formatting.trimTrailingBlankLines`         | `true`   | Removes extra blank lines at the end of the file.                       |
| `bnf.formatting.preserveContinuationLineBreaks` | `false`  | Keeps existing indented continuation line breaks.                       |
| `bnf.formatting.spaceBeforeInlineComment`       | `2`      | Sets spaces before inline semicolon comments in rule bodies.            |
| `bnf.formatting.insertFinalNewline`             | `true`   | Ends formatted files with one final newline.                            |
| `bnf.inlayHints.referenceCount`                 | `false`  | Shows reference counts after rule names.                                |
| `bnf.inlayHints.recursion`                      | `false`  | Marks rules that reference themselves directly.                         |
| `bnf.inlayHints.unusedMarker`                   | `false`  | Marks rules with no references.                                         |
| `bnf.inlayHints.syntaxDetails`                  | `false`  | Shows syntax hints for repetitions, terminals, and character classes.   |
| `bnf.semanticHighlighting.mode`                 | `auto`   | Uses `auto`, `on`, or `off` for semantic tokens.                        |
| `bnf.semanticHighlighting.maxTokens`            | `20000`  | Sets the semantic-token limit in `auto` mode. Use `0` for no limit.     |

## If Something Looks Wrong

- No highlighting: set the VS Code language mode to `ABNF`, `BNF`, `EBNF`, or
  `RBNF`.
- No diagnostics: check `bnf.diagnostics.enable`.
- Missing-rule errors feel noisy: set `bnf.diagnostics.undefinedReferences` to
  `false`.
- Large files feel slow: set `bnf.semanticHighlighting.mode` to `off`, or lower
  `bnf.semanticHighlighting.maxTokens`.
- Formatter changes too much: adjust `bnf.formatting.*` settings, then format a
  small selection before formatting the full file.

## Maintainers And Agents

- [AGENTS.md](AGENTS.md): commands, code boundaries, and verification rules.
- [ARCHITECTURE.md](ARCHITECTURE.md): module map and invariants.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution workflow.
- [`client/src/__tests__`](client/src/__tests__): parser, formatter, provider,
  and TextMate grammar expectations.

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xsyetopz/vscode-bnf-intellisense&type=Date)](https://www.star-history.com/#xsyetopz/vscode-bnf-intellisense&Date)

## License

[MIT](LICENSE)
