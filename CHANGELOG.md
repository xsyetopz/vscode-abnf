# Changelog

User-facing changes go in this file.

## [0.2.1] - 2026-08-27

### Fixed

- Comment text no longer receives grammar operator or delimiter highlighting.

## [0.1.0] - 2026-04-23

BNF-family reset release.

### Added

- Four grammar families:
  - ABNF (`.abnf`) via RFC 5234 and RFC 7405
  - BNF (`.bnf`) via W3C BNF notation
  - EBNF (`.ebnf`) via strict W3C XML EBNF
  - RBNF (`.rbnf`) via RFC 5511
- Syntax highlighting, semantic highlighting, hover, definition, references,
  rename, symbols, inlay hints, diagnostics, formatting, and snippets.
- Workspace-aware rule navigation and completion.
- Hover and navigation for built-in ABNF core rules.
- JSON example grammars for all four supported notations.

### Changed

- Extension renamed as a BNF-family grammar extension.
- EBNF support now targets W3C XML EBNF only.
- Settings use one `bnf.*` namespace for all grammar families.

### Fixed

- W3C EBNF character syntax such as `#x20` and `[#x20-#x21]` no longer reports
  false missing-rule diagnostics.
- Spaced rule names and mixed grammar constructs tokenize consistently across
  dialects.
- Formatter layout settings work across grammar families.
