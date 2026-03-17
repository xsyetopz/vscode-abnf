import {
	type CancellationToken,
	InlayHint,
	InlayHintKind,
	type InlayHintsProvider,
	type Range,
	type TextDocument,
	workspace,
} from "vscode";
import type { DocumentManager } from "../document-manager.ts";

type ManagerResult = ReturnType<DocumentManager["get"]>;
type AbnfRule = ManagerResult["document"]["rules"][number];

function buildHintParts(
	rule: AbnfRule,
	symbolTable: ManagerResult["symbolTable"],
	showRefCount: boolean,
	showRecursion: boolean,
	showUnused: boolean,
): string[] {
	const parts: string[] = [];

	const refCount =
		symbolTable.references.get(rule.name.toLowerCase())?.length ?? 0;

	if (showRefCount) {
		parts.push(`${refCount} ref${refCount === 1 ? "" : "s"}`);
	}

	if (showRecursion) {
		const isRecursive = rule.references.some(
			(r) => r.name.toLowerCase() === rule.name.toLowerCase(),
		);
		if (isRecursive) {
			parts.push("recursive");
		}
	}

	if (showUnused && refCount === 0) {
		parts.push("unused");
	}

	return parts;
}

export class AbnfInlayHintsProvider implements InlayHintsProvider {
	private readonly manager: DocumentManager;
	constructor(manager: DocumentManager) {
		this.manager = manager;
	}

	provideInlayHints(
		doc: TextDocument,
		range: Range,
		_token: CancellationToken,
	): InlayHint[] {
		const { document, symbolTable } = this.manager.get(doc);
		const hints: InlayHint[] = [];
		const config = workspace.getConfiguration("abnf");

		const showRefCount = config.get<boolean>(
			"inlayHints.referenceCount",
			false,
		);
		const showRecursion = config.get<boolean>("inlayHints.recursion", false);
		const showUnused = config.get<boolean>("inlayHints.unusedMarker", false);

		if (!(showRefCount || showRecursion || showUnused)) {
			return hints;
		}

		for (const rule of document.rules) {
			if (!range.intersection(rule.definitionRange)) {
				continue;
			}

			const parts = buildHintParts(
				rule,
				symbolTable,
				showRefCount,
				showRecursion,
				showUnused,
			);

			if (parts.length > 0) {
				const hint = new InlayHint(
					rule.nameRange.end,
					` ${parts.join(", ")}`,
					InlayHintKind.Parameter,
				);
				hint.paddingLeft = true;
				hints.push(hint);
			}
		}

		return hints;
	}
}
