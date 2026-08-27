import { workspace } from "vscode";

export function readGrammarConfig<T>(key: string, fallback: T): T {
  return workspace.getConfiguration("bnf").get<T>(key, fallback);
}
