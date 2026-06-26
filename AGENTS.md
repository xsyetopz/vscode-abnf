# AGENTS.md

Use this file when an agent edits this repository. A nested `AGENTS.md` controls
files under its own directory.

## Start Here

- [README.md](README.md): supported grammars, settings, commands, and usage.
- [ARCHITECTURE.md](ARCHITECTURE.md): module map and rules that code must keep.
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution workflow and PR checklist.
- [CHANGELOG.md](CHANGELOG.md): user-facing release notes.

## Commands

```bash
bun install
bun run biome:check
bun run typecheck
bun test
bun run build
bun run package
```

`bun run biome:check` edits files because the script passes `--write --unsafe`.
Run the command only when formatter and lint edits are allowed.

## Code Boundaries

- `client/src/abnf/` owns ABNF tokenizing, parsing, core rules, and formatting.
- `client/src/grammar/` owns shared BNF-family parsing, diagnostics, formatting,
  semantic tokens, configuration, and workspace symbol logic.
- `client/src/grammar/providers/` contains VS Code provider implementations.
- `client/src/__tests__/` contains Bun tests and the VS Code mock.
- `syntaxes/` contains TextMate grammar JSON and markdown injections.
- `snippets/` contains VS Code snippets for each supported grammar.
- `examples/` contains equivalent sample grammars for humans and tests.

## Style And Invariants

- Keep TypeScript ESM imports explicit, including `.ts` extensions.
- Use the `bnf.*` settings namespace for every supported grammar family.
- Do not reintroduce legacy `abnf.*` setting aliases or deprecated compatibility layers.
- Prefer `readGrammarConfig` for extension settings.
- Keep ABNF core-rule behavior centralized in the ABNF/core-rule modules.
- Preserve W3C XML EBNF semantics. ISO/IEC 14977 EBNF is not supported.
- Keep files focused and below the repository's 800-line limit.

## Verification

Before finishing code changes, run:

```bash
bun run biome:check
bun run typecheck
bun test
bun run build
```

For TextMate grammar changes, also open representative `.abnf`, `.bnf`, `.ebnf`,
and `.rbnf` examples in a VS Code extension host when practical.

## Security And Privacy

This is a local VS Code extension. Do not add telemetry, network calls,
credential handling, or external services without maintainer agreement and user
documentation. Never commit secrets or real user grammar files.
