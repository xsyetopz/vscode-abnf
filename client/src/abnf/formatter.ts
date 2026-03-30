import {
	type CancellationToken,
	type DocumentFormattingEditProvider,
	type FormattingOptions,
	Range,
	type TextDocument,
	TextEdit,
	workspace,
} from "vscode";
import {
	type AbnfAlternativeIndent,
	type AbnfBreakAlternatives,
	formatAbnfDocument,
} from "./format.ts";

export class AbnfFormattingProvider implements DocumentFormattingEditProvider {
	provideDocumentFormattingEdits(
		document: TextDocument,
		_options: FormattingOptions,
		_token: CancellationToken,
	): TextEdit[] {
		const text = document.getText();
		if (text.trim().length === 0) {
			return [];
		}

		const config = workspace.getConfiguration("abnf");
		const alignEquals = config.get<boolean>("formatting.alignEquals", true);
		const continuationIndent = config.get<number>(
			"formatting.continuationIndent",
			4,
		);
		const alternativeIndent = config.get<AbnfAlternativeIndent>(
			"formatting.alternativeIndent",
			"align",
		);
		const insertFinalNewline = config.get<boolean>(
			"formatting.insertFinalNewline",
			true,
		);
		const blankLinesBetweenRules = config.get<number>(
			"formatting.blankLinesBetweenRules",
			1,
		);
		const breakAlternatives = config.get<AbnfBreakAlternatives>(
			"formatting.breakAlternatives",
			"always",
		);
		const maxLineLength = config.get<number>("formatting.maxLineLength", 80);
		const preserveContinuationLineBreaks = config.get<boolean>(
			"formatting.preserveContinuationLineBreaks",
			false,
		);
		const spaceBeforeInlineComment = config.get<number>(
			"formatting.spaceBeforeInlineComment",
			2,
		);

		const result = formatAbnfDocument(text, {
			alignEquals,
			continuationIndent,
			alternativeIndent,
			insertFinalNewline,
			blankLinesBetweenRules,
			breakAlternatives,
			maxLineLength,
			preserveContinuationLineBreaks,
			spaceBeforeInlineComment,
		});

		const fullRange = new Range(
			document.positionAt(0),
			document.positionAt(text.length),
		);

		return [TextEdit.replace(fullRange, result)];
	}
}
